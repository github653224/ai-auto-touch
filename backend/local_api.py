import os
import torch
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoModel, AutoTokenizer, AutoModelForCausalLM
import uvicorn

# 尝试导入GLM4V特定的模型类（如果可用）
try:
    from transformers import Glm4vForConditionalGeneration
    HAS_GLM4V = True
except ImportError:
    try:
        # 尝试从glm4v模块导入
        from transformers.models.glm4v import Glm4vForConditionalGeneration
        HAS_GLM4V = True
    except ImportError:
        HAS_GLM4V = False
        print("⚠️  警告: 无法导入 Glm4vForConditionalGeneration")
        print("⚠️  提示: 可能需要更新transformers版本: pip install transformers>=5.0.0rc0")


# 优先使用环境变量，否则尝试本地路径，最后使用Hugging Face
_default_model = "zai-org/AutoGLM-Phone-9B"
_local_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "AutoGLM-Phone-9B")

if os.getenv("LOCAL_MODEL_ID"):
    MODEL_ID = os.getenv("LOCAL_MODEL_ID")
elif os.path.exists(_local_path) and os.path.isdir(_local_path):
    MODEL_ID = _local_path
    print(f"使用本地模型: {MODEL_ID}")
else:
    MODEL_ID = _default_model
    print(f"使用Hugging Face模型: {MODEL_ID}")
app = FastAPI(title="Local Transformers API")


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: list[Message]
    max_tokens: int | None = 512
    temperature: float | None = 0.7
    top_p: float | None = 0.9


def _load_model():
    print(f"正在加载模型: {MODEL_ID}")
    use_mps = torch.backends.mps.is_available()
    device = "mps" if use_mps else "cpu"
    dtype = torch.float16 if use_mps else torch.float32
    
    print(f"使用设备: {device}, 数据类型: {dtype}")

    # 加载tokenizer
    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_ID, 
        trust_remote_code=True,
        fix_mistral_regex=True  # 修复tokenizer警告
    )
    
    # GLM4V是多模态模型，需要尝试使用Glm4vForConditionalGeneration
    # 注意：GLM4V模型通常需要通过vLLM等服务运行，直接加载可能功能受限
    try:
        # 方法1: 尝试使用Glm4vForConditionalGeneration（如果有）
        if HAS_GLM4V:
            print("尝试使用 Glm4vForConditionalGeneration 加载...")
            try:
                model = Glm4vForConditionalGeneration.from_pretrained(
                    MODEL_ID,
                    dtype=dtype,
                    device_map="auto",
                    trust_remote_code=True,
                )
                print(f"✓ 成功使用 Glm4vForConditionalGeneration 加载")
                if hasattr(model, 'generate'):
                    print("✓ 模型支持generate方法")
                else:
                    print("⚠️  警告: 模型没有generate方法")
            except Exception as e:
                print(f"⚠️  Glm4vForConditionalGeneration加载失败: {e}")
                print("尝试使用 AutoModel 加载...")
                model = AutoModel.from_pretrained(
                    MODEL_ID,
                    dtype=dtype,
                    device_map="auto",
                    trust_remote_code=True,
                )
        else:
            # 方法2: 使用AutoModel（会加载为Glm4vModel，没有generate方法）
            print("GLM4V是多模态模型，使用 AutoModel 加载...")
            print("⚠️  注意: AutoModel会加载为Glm4vModel，可能没有generate方法")
            model = AutoModel.from_pretrained(
                MODEL_ID,
                dtype=dtype,
                device_map="auto",
                trust_remote_code=True,
            )
        
        # 检查模型类型和功能
        model_type = type(model).__name__
        print(f"模型类型: {model_type}")
        
        # 检查是否有generate方法
        if not hasattr(model, 'generate'):
            print("⚠️  警告: 模型没有generate方法")
            print("⚠️  提示: GLM4V模型建议使用vLLM服务以获得完整功能")
            print("⚠️  当前实现可能无法正常工作，建议使用vLLM服务")
            print("💡 解决方案: 运行 ./start_vllm.sh 启动vLLM服务")
            
    except ValueError as e:
        if "Unrecognized configuration class" in str(e) or "Glm4vConfig" in str(e):
            print("❌ 错误: GLM4V模型无法直接用transformers加载")
            print("💡 解决方案:")
            print("   1. 使用vLLM服务（推荐）:")
            print("      python3 -m vllm.entrypoints.openai.api_server \\")
            print("        --model ./models/AutoGLM-Phone-9B \\")
            print("        --port 8000")
            print("   2. 或参考README.md中的vLLM部署指南")
            raise ValueError(
                "GLM4V模型需要使用vLLM服务，不能直接用transformers加载。"
                "请使用vLLM启动模型服务。"
            ) from e
        else:
            raise
    except Exception as e:
        print(f"❌ 加载模型时出错: {e}")
        print("💡 提示: GLM4V模型建议使用vLLM服务")
        raise
    
    model.eval()  # 设置为评估模式
    print("模型加载完成!")
    return tokenizer, model, device


# 启动时加载模型
print("=" * 50)
print("初始化模型服务...")
tokenizer, model, device = _load_model()
print("=" * 50)


@app.post("/v1/chat/completions")
def chat(req: ChatRequest):
    # 检查模型是否有generate方法
    if not hasattr(model, 'generate'):
        return {
            "error": {
                "message": "模型不支持文本生成。GLM4V模型需要使用vLLM服务。",
                "type": "unsupported_model",
                "solution": "请使用 ./start_vllm.sh 启动vLLM服务，或参考 vLLM启动指南.md"
            }
        }
    
    # 构建对话格式
    prompt = "\n".join([f"{m.role}: {m.content}" for m in req.messages]) + "\nassistant:"
    
    try:
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        
        # 使用generate方法生成文本
        with torch.no_grad():
            output = model.generate(
                **inputs,
                max_new_tokens=req.max_tokens or 512,
                temperature=req.temperature or 0.7,
                top_p=req.top_p or 0.9,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
            )
        
        # 解码生成的文本（只取新生成的部分）
        generated_text = tokenizer.decode(output[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
        
        return {
            "id": "chatcmpl-local",
            "object": "chat.completion",
            "model": req.model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": generated_text},
                    "finish_reason": "stop",
                }
            ],
        }
    except Exception as e:
        return {
            "error": {
                "message": f"生成文本时出错: {str(e)}",
                "type": "generation_error",
                "solution": "GLM4V模型建议使用vLLM服务以获得完整功能"
            }
        }
    return {
        "id": "chatcmpl-local",
        "object": "chat.completion",
        "model": req.model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

