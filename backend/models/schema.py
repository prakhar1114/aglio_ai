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
    qty = Column(Integer, nullable=False)
    note = Column(Text)
    state = Column(Enum("pending", "locked", "ordered", name="cart_item_state"), default="pending", nullable=False)
    version = Column(Integer, default=1)

    session = relationship("Session", back_populates="cart_items")
    member = relationship("Member", back_populates="cart_items")
    menu_item = relationship("MenuItem")

    __table_args__ = (
        UniqueConstraint("id", "version", name="uix_item_version"),
    )


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    payload = Column(JSON, nullable=False)  # Cart items data
    cart_hash = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)  # Total in Indian Rs
    pay_method = Column(String, nullable=False)  # Payment method
    pos_ticket = Column(String)  # Reserved for future POS integration
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="orders")


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
# Menu
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
    price = Column(Float, nullable=False)
    image_path = Column(String)
    cloudflare_image_id = Column(String, nullable=True)  # Cloudflare Images ID
    cloudflare_video_id = Column(String, nullable=True)  # Cloudflare Stream video ID
    veg_flag = Column(Boolean, default=False)
    is_bestseller = Column(Boolean, default=False)
    is_recommended = Column(Boolean, default=False)
    kind = Column(Enum("food", "ad", name="menuitem_kind"), default="food")
    priority = Column(Integer, default=0)
    promote = Column(Boolean, default=False)

    restaurant = relationship("Restaurant", back_populates="menu_items")


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def init_db():
    """Create all tables based on the declarative Base metadata."""
    import logging

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logging.exception("Failed creating database schema: %s", exc)
        raise 