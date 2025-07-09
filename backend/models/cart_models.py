from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Request models
class AddonSelection(BaseModel):
    addon_group_item_id: int = Field(..., description="Addon group item ID")
    quantity: int = Field(1, ge=1, description="Addon quantity")

class CartItemCreateRequest(BaseModel):
    session_pid: str = Field(..., description="Session public ID")
    menu_item_id: str = Field(..., description="Menu item public ID")
    qty: int = Field(..., ge=1, description="Quantity (must be >= 1)")
    note: str = Field("", description="Special instructions")
    selected_item_variation_id: Optional[int] = Field(None, description="Selected item variation ID")
    selected_addons: List[AddonSelection] = Field([], description="Selected addons")

class CartItemUpdateRequest(BaseModel):
    session_pid: str = Field(..., description="Session public ID")
    qty: int = Field(..., ge=1, description="New quantity (must be >= 1)")
    note: str = Field("", description="Updated special instructions")
    version: int = Field(..., description="Current item version for optimistic locking")

class CartItemDeleteRequest(BaseModel):
    session_pid: str = Field(..., description="Session public ID")
    version: int = Field(..., description="Current item version for optimistic locking")

# Response models
class SelectedAddonResponse(BaseModel):
    addon_group_item_id: int
    name: str
    price: float
    quantity: int
    total_price: float
    addon_group_name: str  # Include group name for display
    tags: List[str] = []  # Include tags (veg, spicy, etc.)

class SelectedVariationResponse(BaseModel):
    item_variation_id: int
    variation_name: str
    group_name: str  # "Size", "Quantity", etc.
    price: float  # Absolute price for this variation

class CartItemResponse(BaseModel):
    public_id: str  # Use cart item public ID instead of database ID
    member_pid: str
    menu_item_pid: str  # Menu item public ID for consistency
    name: str
    base_price: float  # Base price of the menu item
    final_price: float  # Final price including variation and addons
    qty: int
    note: str
    version: int
    image_url: Optional[str] = None  # Add image URL for cart rendering
    cloudflare_image_id: Optional[str] = None  # Cloudflare Images ID
    cloudflare_video_id: Optional[str] = None  # Cloudflare Stream video ID
    veg_flag: bool = False  # Add veg flag for dietary indicators
    selected_variation: Optional[SelectedVariationResponse] = None
    selected_addons: List[SelectedAddonResponse] = []
    selected_variation_addons: List[SelectedAddonResponse] = []

class MemberInfo(BaseModel):
    member_pid: str
    nickname: str
    is_host: bool

class CartSnapshotResponse(BaseModel):
    items: List[CartItemResponse]
    members: List[MemberInfo]
    cart_version: int
    cart_locked: bool = False
    pending_order_id: Optional[str] = None
    order_processing_status: str = "idle"
    locked_by_member: Optional[str] = None
    orders: List[dict] = []  # Completed orders from database

class CartItemCreateResponse(BaseModel):
    success: bool = True
    data: dict  # {"public_id": str, "version": int}

class CartItemUpdateResponse(BaseModel):
    success: bool = True
    data: dict  # {"version": int}

# WebSocket event models
class CartMutateEvent(BaseModel):
    op: str = Field(..., description="Operation: create|update|delete|replace")
    tmpId: Optional[str] = Field(None, description="Temporary ID for create/replace operations")
    public_id: Optional[str] = Field(None, description="Cart item public ID for update/delete/replace")
    version: Optional[int] = Field(None, description="Version for update/delete/replace")
    menu_item_id: Optional[str] = Field(None, description="Menu item public ID for create/replace")
    qty: int = Field(..., description="Quantity")
    note: str = Field("", description="Special instructions")
    selected_item_variation_id: Optional[int] = Field(None, description="Selected item variation ID")
    selected_addons: List[AddonSelection] = Field([], description="Selected addons")

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