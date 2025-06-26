from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Request models
class CartItemCreateRequest(BaseModel):
    session_pid: str = Field(..., description="Session public ID")
    menu_item_id: str = Field(..., description="Menu item public ID")
    qty: int = Field(..., ge=1, description="Quantity (must be >= 1)")
    note: str = Field("", description="Special instructions")

class CartItemUpdateRequest(BaseModel):
    session_pid: str = Field(..., description="Session public ID")
    qty: int = Field(..., ge=1, description="New quantity (must be >= 1)")
    note: str = Field("", description="Updated special instructions")
    version: int = Field(..., description="Current item version for optimistic locking")

class CartItemDeleteRequest(BaseModel):
    session_pid: str = Field(..., description="Session public ID")
    version: int = Field(..., description="Current item version for optimistic locking")

# Response models
class CartItemResponse(BaseModel):
    public_id: str  # Use cart item public ID instead of database ID
    member_pid: str
    menu_item_pid: str  # Menu item public ID for consistency
    name: str
    price: float  # Add price field for cart rendering
    qty: int
    note: str
    version: int
    image_url: Optional[str] = None  # Add image URL for cart rendering
    cloudflare_image_id: Optional[str] = None  # Cloudflare Images ID
    cloudflare_video_id: Optional[str] = None  # Cloudflare Stream video ID
    veg_flag: bool = False  # Add veg flag for dietary indicators

class MemberInfo(BaseModel):
    member_pid: str
    nickname: str
    is_host: bool

class CartSnapshotResponse(BaseModel):
    items: List[CartItemResponse]
    members: List[MemberInfo]
    orders: List[dict] = []  # Will be populated when order submission is implemented
    cart_version: int

class CartItemCreateResponse(BaseModel):
    success: bool = True
    data: dict  # {"public_id": str, "version": int}

class CartItemUpdateResponse(BaseModel):
    success: bool = True
    data: dict  # {"version": int}

# WebSocket event models
class CartMutateEvent(BaseModel):
    op: str = Field(..., description="Operation: create|update|delete")
    tmpId: Optional[str] = Field(None, description="Temporary ID for create operations")
    public_id: Optional[str] = Field(None, description="Cart item public ID for update/delete")
    version: Optional[int] = Field(None, description="Version for update/delete")
    menu_item_id: Optional[str] = Field(None, description="Menu item public ID for create")
    qty: int = Field(..., description="Quantity")
    note: str = Field("", description="Special instructions")

class CartUpdateEvent(BaseModel):
    type: str = "cart_update"
    op: str
    item: CartItemResponse
    tmpId: Optional[str] = None

class CartErrorEvent(BaseModel):
    type: str = "error"
    code: str
    detail: str
    currentItem: Optional[dict] = None

class OrderCompletedEvent(BaseModel):
    type: str = "order_completed"
    order_id: str
    total_amount: float
    pay_method: str
    items: List[dict]  # The order items data

class CartClearedEvent(BaseModel):
    type: str = "cart_cleared"
    reason: str = "order_placed"

# Order submission models
class OrderItemRequest(BaseModel):
    public_id: str = Field(..., description="Cart item public ID")
    qty: int = Field(..., ge=1, description="Quantity")
    note: str = Field("", description="Special instructions")

class OrderSubmissionRequest(BaseModel):
    session_pid: str = Field(..., description="Session public ID")
    items: List[OrderItemRequest] = Field(..., description="Cart items to order")
    cart_hash: str = Field(..., description="Cart hash for validation")
    pay_method: str = Field(..., description="Payment method")

class OrderSubmissionResponse(BaseModel):
    success: bool = True
    data: dict  # {"order_id": str}

class CartMismatchResponse(BaseModel):
    success: bool = False
    code: str = "cart_mismatch"
    detail: str = "Hash differs; refresh cart."
    cart_snapshot: CartSnapshotResponse

# Standard error response
class ErrorResponse(BaseModel):
    success: bool = False
    code: str
    detail: str 