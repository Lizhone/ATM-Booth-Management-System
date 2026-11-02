
import os
import re
import secrets
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import quote_plus

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from models import db, Customer, Account, Transaction


load_dotenv()

ALLOWED_ACCOUNT_TYPES = {
    "Saving Account",
    "Fixed Deposit Account",
    "Current Account",
    "Recurring Deposit Account",
}

ALLOWED_SERVICES = {
    "ATM Card",
    "Debit Card",
    "Internet Banking",
    "Mobile Banking",
    "SMS Alerts",
    "Cheque Book",
}

FAST_CASH_AMOUNTS = {
    Decimal("500"),
    Decimal("1000"),
    Decimal("2000"),
    Decimal("3000"),
    Decimal("5000"),
}


def create_app():
    app = Flask(__name__)

    # SQL Server connection using Windows Authentication.
    server = os.getenv("DB_SERVER", r"LAPTOP-C2KQL5SD\SQLEXPRESS")
    database = os.getenv("DB_NAME", "ATM_Booth")
    driver = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

    connection_string = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
    )

    app.config["SQLALCHEMY_DATABASE_URI"] = (
        "mssql+pyodbc:///?odbc_connect="
        + quote_plus(connection_string)
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    CORS(app)

    # ---------------------------------------------------------
    # Helper functions
    # ---------------------------------------------------------

    def get_account(account_number):
        if not account_number:
            return None

        return Account.query.filter_by(
            account_number=str(account_number).strip()
        ).first()

    def get_customer_for_account(account):
        if account is None:
            return None

        return db.session.get(Customer, account.customer_id)

    def verify_pin(account, pin):
        customer = get_customer_for_account(account)

        return (
            customer is not None
            and isinstance(pin, str)
            and check_password_hash(customer.pin_hash, pin)
        )

    def parse_amount(value):
        try:
            amount = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return None

        if not amount.is_finite() or amount <= 0:
            return None

        if amount.as_tuple().exponent < -2:
            return None

        return amount

    def get_balance(account):
        return Decimal(str(account.balance or 0))

    def serialize_transaction(transaction):
        return {
            "transaction_id": transaction.transaction_id,
            "transaction_type": transaction.transaction_type,
            "amount": float(transaction.amount),
            "transaction_date": (
                transaction.transaction_date.isoformat()
                if transaction.transaction_date
                else None
            ),
            "description": transaction.description,
        }

    def record_transaction(account, transaction_type, amount, description):
        transaction = Transaction(
            account_id=account.account_id,
            transaction_type=transaction_type,
            amount=amount,
            transaction_date=datetime.now(timezone.utc),
            description=description,
        )
        db.session.add(transaction)
        return transaction

    def perform_withdrawal(account, amount, description):
        """Shared withdrawal logic for normal and Fast Cash withdrawals."""

        balance = get_balance(account)

        if amount > balance:
            return jsonify({"message": "Insufficient balance."}), 400

        try:
            account.balance = balance - amount

            record_transaction(
                account,
                "WITHDRAWAL",
                amount,
                description,
            )

            db.session.commit()

            return jsonify({
                "message": "Withdrawal successful.",
                "amount": float(amount),
                "balance": float(account.balance),
            }), 200

        except Exception:
            db.session.rollback()
            app.logger.exception("Withdrawal failed")
            return jsonify({
                "message": "Withdrawal failed. Please try again."
            }), 500

    # ---------------------------------------------------------
    # Health check
    # ---------------------------------------------------------

    @app.get("/api/health")
    def health():
        try:
            db.session.execute(db.text("SELECT 1"))
            return jsonify({
                "message": "ATM backend is running.",
                "database": "Connected",
            }), 200
        except Exception:
            db.session.rollback()
            app.logger.exception("Database health check failed")
            return jsonify({
                "message": "ATM backend is running, but the database connection failed."
            }), 500

    # ---------------------------------------------------------
    # Customer registration
    # ---------------------------------------------------------

    @app.post("/api/register")
    def register():
        data = request.get_json(silent=True) or {}

        full_name = str(data.get("full_name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        phone = str(data.get("phone", "")).strip()
        pin = data.get("pin")

        if not full_name or not email or not phone:
            return jsonify({
                "message": "Full name, email, and phone are required."
            }), 400

        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            return jsonify({"message": "Enter a valid email address."}), 400

        if not isinstance(pin, str) or not re.fullmatch(r"\d{4}", pin):
            return jsonify({
                "message": "The account PIN must contain exactly four digits."
            }), 400

        if not str(data.get("pan_number", "")).strip():
            return jsonify({"message": "PAN number is required."}), 400

        aadhaar_number = str(data.get("aadhaar_number", "")).strip()
        if not re.fullmatch(r"\d{12}", aadhaar_number):
            return jsonify({
                "message": "Aadhaar number must contain exactly 12 digits."
            }), 400

        pin_code = str(data.get("pin_code", "")).strip()
        if not re.fullmatch(r"\d{6}", pin_code):
            return jsonify({
                "message": "Postal PIN code must contain exactly 6 digits."
            }), 400

        dob_value = data.get("dob") or data.get("date_of_birth")
        dob = None

        if dob_value:
            try:
                dob = date.fromisoformat(str(dob_value))
            except ValueError:
                return jsonify({
                    "message": "Enter a valid date of birth."
                }), 400

            if dob > date.today():
                return jsonify({
                    "message": "Date of birth cannot be in the future."
                }), 400

        account_type = str(data.get("account_type", "")).strip()
        if account_type not in ALLOWED_ACCOUNT_TYPES:
            return jsonify({
                "message": "Select a valid account type."
            }), 400

        services = data.get("services_required", [])

        if isinstance(services, str):
            services = [
                item.strip()
                for item in services.split(",")
                if item.strip()
            ]

        if not isinstance(services, list):
            return jsonify({
                "message": "Services required must be a list."
            }), 400

        services = list(dict.fromkeys(services))

        if any(
            not isinstance(service, str)
            or service not in ALLOWED_SERVICES
            for service in services
        ):
            return jsonify({
                "message": "One or more selected services are invalid."
            }), 400

        senior_citizen = str(
            data.get("senior_citizen", "No")
        ).strip()

        existing_account = str(
            data.get("existing_account", "No")
        ).strip()

        if senior_citizen not in {"Yes", "No"}:
            return jsonify({
                "message": "Select Yes or No for senior citizen."
            }), 400

        if existing_account not in {"Yes", "No"}:
            return jsonify({
                "message": "Select Yes or No for existing account."
            }), 400

        try:
            customer = Customer(
                full_name=full_name,
                email=email,
                phone=phone,
                pin_hash=generate_password_hash(pin),
                father_name=data.get("father_name"),
                date_of_birth=dob,
                gender=data.get("gender"),
                marital_status=data.get("marital_status"),
                address=data.get("address"),
                city=data.get("city"),
                pin_code=pin_code,
                state=data.get("state"),
                religion=data.get("religion"),
                category=data.get("category"),
                annual_income=data.get("income"),
                education=data.get("education"),
                occupation=data.get("occupation"),
                pan_number=str(data.get("pan_number", "")).strip().upper(),
                aadhaar_number=aadhaar_number,
                senior_citizen=senior_citizen,
                existing_account=existing_account,
            )

            db.session.add(customer)
            db.session.flush()

            # Generate a unique 10-digit account number.
            account_number = None

            for _ in range(20):
                candidate = str(secrets.randbelow(9_000_000_000) + 1_000_000_000)

                if not Account.query.filter_by(
                    account_number=candidate
                ).first():
                    account_number = candidate
                    break

            if account_number is None:
                db.session.rollback()
                return jsonify({
                    "message": "Unable to generate an account number. Please try again."
                }), 500

            account = Account(
                account_number=account_number,
                balance=Decimal("0.00"),
                customer_id=customer.customer_id,
                account_type=account_type,
                services_required=", ".join(services),
            )

            db.session.add(account)
            db.session.commit()

            return jsonify({
                "message": "Registration successful.",
                "account_number": account.account_number,
                "customer": {
                    "customer_id": customer.customer_id,
                    "full_name": customer.full_name,
                    "email": customer.email,
                },
            }), 201

        except IntegrityError:
            db.session.rollback()
            return jsonify({
                "message": "This email or another unique value is already registered."
            }), 409

        except Exception:
            db.session.rollback()
            app.logger.exception("Customer registration failed")
            return jsonify({
                "message": "Registration failed. Please try again."
            }), 500

    # ---------------------------------------------------------
    # Customer login
    # ---------------------------------------------------------

    @app.post("/api/login")
    def login():
        data = request.get_json(silent=True) or {}

        account_number = str(
            data.get("account_number", "")
        ).strip()

        pin = data.get("pin")

        if not account_number or not isinstance(pin, str):
            return jsonify({
                "message": "Account number and PIN are required."
            }), 400

        if not re.fullmatch(r"\d{4}", pin):
            return jsonify({
                "message": "PIN must contain exactly four digits."
            }), 400

        account = get_account(account_number)

        if account is None or not verify_pin(account, pin):
            return jsonify({
                "message": "Invalid account number or PIN."
            }), 401

        customer = get_customer_for_account(account)

        return jsonify({
            "message": "Login successful.",
            "customer": {
                "customer_id": customer.customer_id,
                "full_name": customer.full_name,
                "email": customer.email,
                "account_number": account.account_number,
            },
        }), 200

    # ---------------------------------------------------------
    # Balance enquiry
    # ---------------------------------------------------------

    @app.post("/api/balance")
    def balance_enquiry():
        data = request.get_json(silent=True) or {}
        account = get_account(data.get("account_number"))

        if account is None:
            return jsonify({"message": "Account not found."}), 404

        if not verify_pin(account, data.get("pin")):
            return jsonify({
                "message": "Invalid account number or PIN."
            }), 401

        return jsonify({
            "message": "Balance retrieved successfully.",
            "account_number": account.account_number,
            "balance": float(get_balance(account)),
        }), 200

    # ---------------------------------------------------------
    # Deposit
    # ---------------------------------------------------------

    @app.post("/api/deposit")
    def deposit():
        data = request.get_json(silent=True) or {}
        account = get_account(data.get("account_number"))

        if account is None:
            return jsonify({"message": "Account not found."}), 404

        if not verify_pin(account, data.get("pin")):
            return jsonify({
                "message": "Invalid account number or PIN."
            }), 401

        amount = parse_amount(data.get("amount"))

        if amount is None:
            return jsonify({
                "message": "Enter a valid amount greater than zero with at most two decimal places."
            }), 400

        try:
            account.balance = get_balance(account) + amount

            record_transaction(
                account,
                "DEPOSIT",
                amount,
                "Cash deposit",
            )

            db.session.commit()

            return jsonify({
                "message": "Deposit successful.",
                "amount": float(amount),
                "balance": float(account.balance),
            }), 200

        except Exception:
            db.session.rollback()
            app.logger.exception("Deposit failed")
            return jsonify({
                "message": "Deposit failed. Please try again."
            }), 500

    # ---------------------------------------------------------
    # Cash withdrawal
    # ---------------------------------------------------------

    @app.post("/api/withdraw")
    def withdraw():
        data = request.get_json(silent=True) or {}
        account = get_account(data.get("account_number"))

        if account is None:
            return jsonify({"message": "Account not found."}), 404

        if not verify_pin(account, data.get("pin")):
            return jsonify({
                "message": "Invalid account number or PIN."
            }), 401

        amount = parse_amount(data.get("amount"))

        if amount is None:
            return jsonify({
                "message": "Enter a valid amount greater than zero with at most two decimal places."
            }), 400

        return perform_withdrawal(
            account,
            amount,
            "Cash withdrawal",
        )

    # ---------------------------------------------------------
    # Fast Cash
    # ---------------------------------------------------------

    @app.post("/api/fast-cash")
    def fast_cash():
        data = request.get_json(silent=True) or {}
        account = get_account(data.get("account_number"))

        if account is None:
            return jsonify({"message": "Account not found."}), 404

        if not verify_pin(account, data.get("pin")):
            return jsonify({
                "message": "Invalid account number or PIN."
            }), 401

        amount = parse_amount(data.get("amount"))

        if amount not in FAST_CASH_AMOUNTS:
            return jsonify({
                "message": "Select a valid Fast Cash amount: ₹500, ₹1,000, ₹2,000, ₹3,000, or ₹5,000."
            }), 400

        return perform_withdrawal(
            account,
            amount,
            "Fast Cash withdrawal",
        )

    # ---------------------------------------------------------
    # Mini statement - latest five transactions
    # ---------------------------------------------------------

    @app.post("/api/mini-statement")
    def mini_statement():
        data = request.get_json(silent=True) or {}
        account = get_account(data.get("account_number"))

        if account is None:
            return jsonify({"message": "Account not found."}), 404

        if not verify_pin(account, data.get("pin")):
            return jsonify({
                "message": "Invalid account number or PIN."
            }), 401

        transactions = (
            Transaction.query
            .filter_by(account_id=account.account_id)
            .order_by(
                Transaction.transaction_date.desc(),
                Transaction.transaction_id.desc(),
            )
            .limit(5)
            .all()
        )

        return jsonify({
            "message": "Mini statement retrieved successfully.",
            "balance": float(get_balance(account)),
            "transactions": [
                serialize_transaction(item)
                for item in transactions
            ],
        }), 200

    # ---------------------------------------------------------
    # Change PIN
    # ---------------------------------------------------------

    @app.post("/api/change-pin")
    def change_pin():
        data = request.get_json(silent=True) or {}
        account = get_account(data.get("account_number"))

        if account is None:
            return jsonify({"message": "Account not found."}), 404

        old_pin = data.get("old_pin")
        new_pin = data.get("new_pin")
        confirm_pin = data.get("confirm_pin")

        if not verify_pin(account, old_pin):
            return jsonify({
                "message": "Current PIN is incorrect."
            }), 401

        if (
            not isinstance(new_pin, str)
            or not re.fullmatch(r"\d{4}", new_pin)
        ):
            return jsonify({
                "message": "New PIN must contain exactly four digits."
            }), 400

        if new_pin == old_pin:
            return jsonify({
                "message": "New PIN must be different from the current PIN."
            }), 400

        if new_pin != confirm_pin:
            return jsonify({
                "message": "PIN confirmation does not match."
            }), 400

        customer = get_customer_for_account(account)

        try:
            customer.pin_hash = generate_password_hash(new_pin)
            db.session.commit()

            return jsonify({
                "message": "PIN changed successfully."
            }), 200

        except Exception:
            db.session.rollback()
            app.logger.exception("PIN change failed")
            return jsonify({
                "message": "Unable to change PIN. Please try again."
            }), 500

    # ---------------------------------------------------------
    # Close database session after each request
    # ---------------------------------------------------------

    @app.teardown_appcontext
    def cleanup_database(exception=None):
        db.session.remove()

    return app


app = create_app()

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(host="127.0.0.1", port=5000, debug=True)
