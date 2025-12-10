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
            verbose=nl_command.verbose
        )
        return AIResponse(
            success=True,
            result=result,
            device_id=device_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-command")
async def execute_batch_command(nl_commands: list[NLCommand]):
    """批量执行自然语言指令"""
    try:
        results = []
        for cmd in nl_commands:
            result = await ai_service.execute_natural_language_command(
                device_id=cmd.device_id,
                command=cmd.command,
                verbose=cmd.verbose
            )
            results.append({
                "device_id": cmd.device_id,
                "success": True,
                "result": result
            })
        return {"success": True, "results": results}
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

