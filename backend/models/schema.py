from datetime import datetime, time, date

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Date,
    Time,
    Text,
    Enum,
    ForeignKey,
    SmallInteger,
    JSON,
    UniqueConstraint,
    Index,
    create_engine,
    Float,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.sql import expression

from config import pg_url

# ---------------------------------------------------------------------------
# Database engine & session factory (shared across the backend package)
# ---------------------------------------------------------------------------
engine = create_engine(pg_url, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------
Base = declarative_base()

# ---------------------------------------------------------------------------
# Core tenant objects
# ---------------------------------------------------------------------------
class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    tz = Column(String, nullable=False, default="UTC")
    require_pass = Column(Boolean, default=False)
    api_key = Column(String(12), unique=True, nullable=True)

    hours = relationship("RestaurantHours", back_populates="restaurant")
    tables = relationship("Table", back_populates="restaurant")
    menu_items = relationship("MenuItem", back_populates="restaurant")


class RestaurantHours(Base):
    __tablename__ = "restaurant_hours"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    day = Column(SmallInteger, nullable=False)  # 0-6 (Sun-Sat)
    opens_at = Column(Time, nullable=False)
    closes_at = Column(Time, nullable=False)

    restaurant = relationship("Restaurant", back_populates="hours")

    __table_args__ = (
        UniqueConstraint("restaurant_id", "day", name="uix_rest_day"),
    )


# ---------------------------------------------------------------------------
# Tables & daily pass
# ---------------------------------------------------------------------------
class Table(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    number = Column(Integer, nullable=False)
    qr_token = Column(Text, unique=True, nullable=False)
    status = Column(Enum("open", "dirty", "disabled", name="table_status"), default="open")

    restaurant = relationship("Restaurant", back_populates="tables")
    sessions = relationship("Session", back_populates="table")


class DailyPass(Base):
    __tablename__ = "daily_passes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    word_hash = Column(String, nullable=False)
    valid_date = Column(Date, nullable=False)

    __table_args__ = (
        UniqueConstraint("restaurant_id", "valid_date", name="uix_rest_date"),
    )


# ---------------------------------------------------------------------------
# Live service
# ---------------------------------------------------------------------------
class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=False)
    state = Column(Enum("active", "closed", "expired", name="session_state"), default="active")
    daily_pass_required = Column(Boolean, default=False)
    pass_validated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity_at = Column(DateTime, default=datetime.utcnow, index=True)

    table = relationship("Table", back_populates="sessions")
    members = relationship("Member", back_populates="session")
    cart_items = relationship("CartItem", back_populates="session")
    orders = relationship("Order", back_populates="session")

    __table_args__ = (
        # ensure one active session per table per restaurant (partial index in Postgres)
        Index(
            "ix_one_open_per_table",
            "restaurant_id",
            "table_id",
            unique=True,
            postgresql_where=expression.text("state = 'active'"),
        ),
    )


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(String, nullable=False)
    nickname = Column(String, nullable=False)
    is_host = Column(Boolean, default=False)
    active = Column(Boolean, default=True)

    session = relationship("Session", back_populates="members")
    cart_items = relationship("CartItem", back_populates="member")


# ---------------------------------------------------------------------------
# Cart & orders
# ---------------------------------------------------------------------------
class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    selected_item_variation_id = Column(Integer, ForeignKey("item_variations.id"), nullable=True)
    qty = Column(Integer, nullable=False)
    note = Column(Text)
    state = Column(Enum("pending", "locked", "ordered", name="cart_item_state"), default="pending", nullable=False)
    version = Column(Integer, default=1)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)

    session = relationship("Session", back_populates="cart_items")
    member = relationship("Member", back_populates="cart_items")
    menu_item = relationship("MenuItem")
    selected_item_variation = relationship("ItemVariation")
    selected_addons = relationship("CartItemAddon", back_populates="cart_item")
    order = relationship("Order", back_populates="cart_items")

    __table_args__ = (
        UniqueConstraint("id", "version", name="uix_item_version"),
    )


class CartItemAddon(Base):
    __tablename__ = "cart_item_addons"

    id = Column(Integer, primary_key=True)
    cart_item_id = Column(Integer, ForeignKey("cart_items.id", ondelete="CASCADE"))
    addon_item_id = Column(Integer, ForeignKey("addon_group_items.id"))
    quantity = Column(Integer, default=1)

    cart_item = relationship("CartItem", back_populates="selected_addons")
    addon_item = relationship("AddonGroupItem")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    initiated_by_member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    payload = Column(JSON, nullable=False)  # Enhanced cart items data with variations/addons
    cart_hash = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)  # Total in Indian Rs
    status = Column(Enum("processing", "confirmed", "failed", "cancelled", name="order_status"), default="processing", nullable=False)
    
    # POS Integration
    pos_system_id = Column(Integer, ForeignKey("pos_systems.id"), nullable=True)
    pos_order_id = Column(String, nullable=True)  # External order ID from POS
    pos_response = Column(JSON, nullable=True)  # Full POS response for debugging
    pos_ticket = Column(String)  # Reserved for future POS integration
    created_at = Column(DateTime, default=datetime.utcnow)
    confirmed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)

    session = relationship("Session", back_populates="orders")
    pos_system = relationship("POSSystem")
    initiated_by_member = relationship("Member")
    cart_items = relationship("CartItem", back_populates="order")


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    kind = Column(String, nullable=False)
    payload = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# ---------------------------------------------------------------------------
# Waiter requests
# ---------------------------------------------------------------------------
class WaiterRequest(Base):
    __tablename__ = "waiter_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    request_type = Column(Enum("call_waiter", "ask_for_bill", name="waiter_request_type"), nullable=False)
    status = Column(Enum("pending", "resolved", name="waiter_request_status"), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)  # person who resolved: do in the future

    session = relationship("Session")
    table = relationship("Table")
    member = relationship("Member")

    __table_args__ = (
        Index("ix_waiter_requests_status", "status"),
        Index("ix_waiter_requests_created_at", "created_at"),
    )


# ---------------------------------------------------------------------------
# POS System Integration
# ---------------------------------------------------------------------------
class POSSystem(Base):
    __tablename__ = "pos_systems"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)  # "petpooja", "posist", "revel", etc.
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"))
    config = Column(JSON)  # POS-specific configuration (API keys, endpoints, etc.)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    restaurant = relationship("Restaurant")


# ---------------------------------------------------------------------------
# Menu Structure (Following PetPooja Architecture)
# ---------------------------------------------------------------------------
class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    name = Column(String, nullable=False)
    category_brief = Column(String)
    group_category = Column(String)
    description = Column(Text)
    price = Column(Float, nullable=False)  # Base price
    image_path = Column(String)
    cloudflare_image_id = Column(String, nullable=True)  # Cloudflare Images ID
    cloudflare_video_id = Column(String, nullable=True)  # Cloudflare Stream video ID
    veg_flag = Column(Boolean, default=False)
    is_bestseller = Column(Boolean, default=False)
    is_recommended = Column(Boolean, default=False)
    kind = Column(Enum("food", "ad", name="menuitem_kind"), default="food")
    priority = Column(Integer, default=0)
    promote = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    tags = Column(JSON, default=list)  # list[str] for frontend rendering
    
    # POS Integration (following simplified architecture)
    external_id = Column(String, nullable=True)  # PetPooja itemid
    external_data = Column(JSON, nullable=True)  # Full POS item data
    itemallowvariation = Column(Boolean, default=False)  # Can this item have variations?
    itemallowaddon = Column(Boolean, default=False)  # Can this item have addons?
    pos_system_id = Column(Integer, ForeignKey("pos_systems.id"), nullable=True)

    restaurant = relationship("Restaurant", back_populates="menu_items")
    pos_system = relationship("POSSystem")
    # Relationships to junction tables
    item_variations = relationship("ItemVariation", back_populates="menu_item")
    item_addons = relationship("ItemAddon", back_populates="menu_item")


# ---------------------------------------------------------------------------
# Global Variations (Reusable across items)
# ---------------------------------------------------------------------------
class Variation(Base):
    __tablename__ = "variations"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)  # "Small", "Large", "3 Pieces"
    display_name = Column(String, nullable=False)
    group_name = Column(String, nullable=False)  # "Size", "Quantity", "Type"
    is_active = Column(Boolean, default=True)
    
    # POS Integration
    external_variation_id = Column(String, nullable=True)  # PetPooja variationid
    external_data = Column(JSON, nullable=True)  # Full POS variation data
    pos_system_id = Column(Integer, ForeignKey("pos_systems.id"), nullable=True)

    pos_system = relationship("POSSystem")
    # Relationships to junction tables
    item_variations = relationship("ItemVariation", back_populates="variation")

    __table_args__ = (
        UniqueConstraint("external_variation_id", "pos_system_id", name="uix_variation_pos"),
    )


# ---------------------------------------------------------------------------
# Global Addon Groups (Reusable across items)
# ---------------------------------------------------------------------------
class AddonGroup(Base):
    __tablename__ = "addon_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)  # "Extra Toppings", "Add Beverage"
    display_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Display order
    
    # POS Integration
    external_group_id = Column(String, nullable=True)  # PetPooja addongroupid
    external_data = Column(JSON, nullable=True)  # Full POS addon group data
    pos_system_id = Column(Integer, ForeignKey("pos_systems.id"), nullable=True)

    pos_system = relationship("POSSystem")
    # Relationships
    addon_items = relationship("AddonGroupItem", back_populates="addon_group")
    item_addons = relationship("ItemAddon", back_populates="addon_group")

    __table_args__ = (
        UniqueConstraint("external_group_id", "pos_system_id", name="uix_addon_group_pos"),
    )


class AddonGroupItem(Base):
    __tablename__ = "addon_group_items"

    id = Column(Integer, primary_key=True)
    addon_group_id = Column(Integer, ForeignKey("addon_groups.id"), nullable=False)
    name = Column(String, nullable=False)  # "Cheese", "Bacon", "Extra Spicy"
    display_name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    tags = Column(JSON, default=list)  # list[str] (veg, spicy, etc.)
    
    # POS Integration
    external_addon_id = Column(String, nullable=True)  # PetPooja addonitemid
    external_data = Column(JSON, nullable=True)  # Full POS addon item data

    addon_group = relationship("AddonGroup", back_populates="addon_items")

    __table_args__ = (
        UniqueConstraint("external_addon_id", "addon_group_id", name="uix_addon_item_pos"),
    )


# ---------------------------------------------------------------------------
# Junction Tables (Item Relationships)
# ---------------------------------------------------------------------------
class ItemVariation(Base):
    """Junction table: MenuItem ←→ Variation with item-specific data"""
    __tablename__ = "item_variations"

    id = Column(Integer, primary_key=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    variation_id = Column(Integer, ForeignKey("variations.id"), nullable=False)
    price = Column(Float, nullable=False)  # Item-specific price for this variation
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    
    # POS Integration
    external_id = Column(String, nullable=True)  # PetPooja variation.id (used for orders)
    external_data = Column(JSON, nullable=True)  # Full POS item-variation data

    menu_item = relationship("MenuItem", back_populates="item_variations")
    variation = relationship("Variation", back_populates="item_variations")

    __table_args__ = (
        UniqueConstraint("menu_item_id", "variation_id", name="uix_item_variation"),
    )


class ItemAddon(Base):
    """Junction table: MenuItem ←→ AddonGroup with selection rules"""
    __tablename__ = "item_addons"

    id = Column(Integer, primary_key=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    addon_group_id = Column(Integer, ForeignKey("addon_groups.id"), nullable=False)
    min_selection = Column(Integer, default=0)
    max_selection = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)

    menu_item = relationship("MenuItem", back_populates="item_addons")
    addon_group = relationship("AddonGroup", back_populates="item_addons")

    __table_args__ = (
        UniqueConstraint("menu_item_id", "addon_group_id", name="uix_item_addon"),
    )


# ---------------------------------------------------------------------------
# Database initialization
# ---------------------------------------------------------------------------
def init_db():
    """Initialize the database tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 