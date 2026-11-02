
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()


class Customer(db.Model):
    __tablename__ = "Customers"

    customer_id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    pin_hash = db.Column(db.String(256), nullable=False)

    # Personal information
    father_name = db.Column(db.String(100), nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    gender = db.Column(db.String(20), nullable=True)
    marital_status = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(250), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    pin_code = db.Column(db.String(10), nullable=True)
    state = db.Column(db.String(100), nullable=True)

    # Additional information
    religion = db.Column(db.String(50), nullable=True)
    category = db.Column(db.String(50), nullable=True)
    annual_income = db.Column(db.String(50), nullable=True)
    education = db.Column(db.String(100), nullable=True)
    occupation = db.Column(db.String(100), nullable=True)
    pan_number = db.Column(db.String(10), nullable=True)
    aadhaar_number = db.Column(db.String(12), nullable=True)
    senior_citizen = db.Column(db.String(5), nullable=True)
    existing_account = db.Column(db.String(5), nullable=True)

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    accounts = db.relationship(
        "Account",
        backref="customer",
        lazy=True
    )


class Account(db.Model):
    __tablename__ = "Accounts"

    account_id = db.Column(db.Integer, primary_key=True)
    account_number = db.Column(
        db.String(20),
        unique=True,
        nullable=False
    )
    balance = db.Column(
        db.Numeric(12, 2),
        nullable=False,
        default=0
    )
    customer_id = db.Column(
        db.Integer,
        db.ForeignKey("Customers.customer_id"),
        nullable=False
    )

    # Account details
    account_type = db.Column(db.String(50), nullable=True)
    services_required = db.Column(db.String(500), nullable=True)

    transactions = db.relationship(
        "Transaction",
        backref="account",
        lazy=True
    )


class Transaction(db.Model):
    __tablename__ = "Transactions"

    transaction_id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(
        db.Integer,
        db.ForeignKey("Accounts.account_id"),
        nullable=False
    )
    transaction_type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    transaction_date = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )
    description = db.Column(db.String(200))
