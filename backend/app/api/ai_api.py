from fastapi import APIRouter, HTTPException, Depends
from app.models.ai_models import NLCommand, AIResponse
from app.services.ai_service import AIService

router = APIRouter()
ai_service = AIService()

@router.post("/command/{device_id}", response_model=AIResponse)
async def execute_nl_command(device_id: str, nl_command: NLCommand):
    """执行自然语言指令"""
    try:
        result = await ai_service.execute_natural_language_command(
            device_id=device_id,
            command=nl_command.command,
            verbose=nl_command.verbose,
            max_steps=nl_command.max_steps,
            base_url=nl_command.base_url,
            model_name=nl_command.model_name,
            api_key=nl_command.api_key
        )
        
        # 检查执行结果中的 success 字段
        if not result.get("success", True):
            # 如果执行失败，抛出异常
            error_msg = result.get("error", "执行指令失败")
            raise HTTPException(status_code=500, detail=error_msg)
        
        return AIResponse(
            success=True,
            result=result,
            device_id=device_id
        )
    except HTTPException:
        # 重新抛出 HTTPException
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-command")
async def execute_batch_command(nl_commands: list[NLCommand]):
    """批量执行自然语言指令"""
    try:
        results = []
        has_error = False
        error_messages = []
        
        for cmd in nl_commands:
            result = await ai_service.execute_natural_language_command(
                device_id=cmd.device_id,
                command=cmd.command,
                verbose=cmd.verbose,
                max_steps=cmd.max_steps,
                base_url=cmd.base_url,
                model_name=cmd.model_name,
                api_key=cmd.api_key
            )
            
            # 检查单个命令的执行结果
            success = result.get("success", True)
            if not success:
                has_error = True
                error_msg = result.get("error", "执行失败")
                error_messages.append(f"设备 {cmd.device_id}: {error_msg}")
            
            results.append({
                "device_id": cmd.device_id,
                "success": success,
                "result": result
            })
        
        # 如果有任何命令失败，返回错误
        if has_error:
            raise HTTPException(
                status_code=500, 
                detail=f"部分命令执行失败: {'; '.join(error_messages)}"
            )
        
        return {"success": True, "results": results}
    except HTTPException:
        # 重新抛出 HTTPException
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_ai_status():
    """获取AI服务状态"""
    try:
        status = await ai_service.get_service_status()
        return {"success": True, "status": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

