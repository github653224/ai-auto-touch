import os
import torch
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer
import uvicorn


MODEL_ID = os.getenv("LOCAL_MODEL_ID", "zai-org/AutoGLM-Phone-9B")
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
    use_mps = torch.backends.mps.is_available()
    device = "mps" if use_mps else "cpu"
    dtype = torch.float16 if use_mps else torch.float32

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        torch_dtype=dtype,
        device_map="auto",
    )
    return tokenizer, model, device


tokenizer, model, device = _load_model()


@app.post("/v1/chat/completions")
def chat(req: ChatRequest):
    prompt = "\n".join([f"{m.role}: {m.content}" for m in req.messages]) + "\nassistant:"
    inputs = tokenizer(prompt, return_tensors="pt").to(device)
    output = model.generate(
        **inputs,
        max_new_tokens=req.max_tokens or 512,
        temperature=req.temperature or 0.7,
        top_p=req.top_p or 0.9,
        do_sample=True,
    )
    text = tokenizer.decode(output[0], skip_special_tokens=True)
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

