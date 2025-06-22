from pydantic import BaseModel, Field
from typing import Optional

# Request models
class TableSessionRequest(BaseModel):
    table_pid: str = Field(..., description="Table public ID from QR code")
    token: str = Field(..., description="HMAC token from QR code")
    device_id: str = Field(..., description="UUID4 device identifier")

class TokenRefreshRequest(BaseModel):
    pass  # Auth via header only

class MemberUpdateRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50, description="New nickname")

# Response models
class TableSessionResponse(BaseModel):
    session_pid: str
    member_pid: str
    nickname: str
    is_host: bool
    ws_token: str
    restaurant_name: str
    table_number: int

class TokenRefreshResponse(BaseModel):
    ws_token: str

class MemberUpdateResponse(BaseModel):
    success: bool = True
    nickname: str

class ErrorResponse(BaseModel):
    success: bool = False
    code: str
    detail: str

# WebSocket event models
class MemberInfo(BaseModel):
    member_pid: str
    nickname: str
    is_host: bool

class MemberJoinEvent(BaseModel):
    type: str = "member_join"
    member: MemberInfo

class ErrorEvent(BaseModel):
    type: str = "error"
    code: str
    detail: str 