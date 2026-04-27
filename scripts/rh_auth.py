#!/usr/bin/env python3
"""
Robinhood Authentication Script
Uses robin_stocks library for proper auth flow with MFA/device verification support.

Usage:
    python scripts/rh_auth.py auth      # Login and get token
    python scripts/rh_auth.py status    # Check current auth status
    python scripts/rh_auth.py logout    # Logout
    python scripts/rh_auth.py accounts  # List accounts
    python scripts/rh_auth.py portfolio # Get portfolio
"""

import os
import sys
import json
import pickle
from pathlib import Path

# Load .env file
from dotenv import load_dotenv
load_dotenv()

try:
    import robin_stocks.robinhood as rh
except ImportError:
    print("Error: robin_stocks not installed. Run: pip install robin-stocks")
    sys.exit(1)

# Token storage path - robin_stocks stores as ~/.tokens/robinhood{name}.pickle
# (it concatenates "robinhood" + name, no subdirectory)
TOKEN_DIR = Path.home() / ".tokens"
TOKEN_NAME = "kampala_session"
# Full path: ~/.tokens/robinhoodkampala_session.pickle

def get_credentials():
    """Get credentials from environment variables."""
    email = os.getenv("RH_USER")
    password = os.getenv("RH_PASS")

    if not email or not password:
        print("Error: RH_USER and RH_PASS environment variables required")
        print("Set them in .env file:")
        print("  RH_USER=your_email@example.com")
        print("  RH_PASS=your_password")
        sys.exit(1)

    return email, password

def mfa_callback():
    """Callback for MFA code input."""
    code = input("Enter MFA code from your authenticator app: ")
    return code

def login(store_session=True):
    """
    Login to Robinhood with full MFA/device verification support.
    Uses robin_stocks which handles the full OAuth flow properly.
    """
    email, password = get_credentials()

    print(f"Logging in as {email}...")

    try:
        # Ensure token directory exists
        TOKEN_DIR.mkdir(parents=True, exist_ok=True)
        # robin_stocks stores as ~/.tokens/robinhood{name}.pickle
        token_file = TOKEN_DIR / f"robinhood{TOKEN_NAME}.pickle"

        # Try to login with stored session first
        if token_file.exists() and store_session:
            print("Found stored session, attempting to use...")
            try:
                login_result = rh.login(
                    email,
                    password,
                    store_session=True,
                    pickle_name=TOKEN_NAME
                )
                if login_result:
                    print("Successfully logged in with stored session!")
                    return {"status": "authenticated", "email": email}
            except Exception as e:
                print(f"Stored session failed: {e}")
                print("Attempting fresh login...")

        # Fresh login with MFA callback
        login_result = rh.login(
            email,
            password,
            mfa_code=mfa_callback,
            store_session=store_session,
            pickle_name=TOKEN_NAME if store_session else None
        )

        if login_result:
            print("Successfully logged in!")
            return {"status": "authenticated", "email": email}
        else:
            print("Login failed - no result returned")
            return {"status": "failed", "error": "Login returned no result"}

    except Exception as e:
        error_msg = str(e)
        print(f"Login error: {error_msg}")

        # Check for device verification
        if "verification" in error_msg.lower() or "challenge" in error_msg.lower():
            return {
                "status": "verification_required",
                "message": "Check your email/SMS and approve the device, then try again"
            }

        return {"status": "failed", "error": error_msg}

def logout():
    """Logout from Robinhood."""
    try:
        rh.logout()
        token_file = TOKEN_DIR / f"robinhood{TOKEN_NAME}.pickle"
        if token_file.exists():
            token_file.unlink()
        print("Logged out successfully")
        return {"status": "logged_out"}
    except Exception as e:
        print(f"Logout error: {e}")
        return {"status": "error", "error": str(e)}

def status():
    """Check current authentication status."""
    try:
        # Try to get profile - will fail if not authenticated
        profile = rh.profiles.load_account_profile()
        if profile:
            return {
                "status": "authenticated",
                "account_number": profile.get("account_number"),
                "buying_power": profile.get("buying_power"),
            }
        else:
            return {"status": "not_authenticated"}
    except Exception as e:
        return {"status": "not_authenticated", "error": str(e)}

def list_accounts():
    """List Robinhood accounts."""
    try:
        accounts = rh.profiles.load_account_profile(info=None)
        if accounts:
            return {
                "status": "ok",
                "accounts": accounts if isinstance(accounts, list) else [accounts]
            }
        return {"status": "no_accounts"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def get_portfolio():
    """Get portfolio summary."""
    try:
        # Get account info
        profile = rh.profiles.load_account_profile()
        portfolio = rh.profiles.load_portfolio_profile()
        positions = rh.account.get_all_positions()

        # Get stock positions
        stock_positions = []
        for pos in positions:
            if float(pos.get("quantity", 0)) > 0:
                instrument = rh.stocks.get_instrument_by_url(pos.get("instrument"))
                symbol = instrument.get("symbol") if instrument else "UNKNOWN"
                stock_positions.append({
                    "symbol": symbol,
                    "quantity": float(pos.get("quantity", 0)),
                    "average_cost": float(pos.get("average_buy_price", 0)),
                })

        return {
            "status": "ok",
            "equity": portfolio.get("equity"),
            "market_value": portfolio.get("market_value"),
            "buying_power": profile.get("buying_power"),
            "positions": stock_positions
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    action = sys.argv[1].lower()

    result = None

    if action == "auth" or action == "login":
        result = login()
    elif action == "logout":
        result = logout()
    elif action == "status":
        result = status()
    elif action == "accounts":
        # Need to be logged in first
        login_result = login()
        if login_result.get("status") == "authenticated":
            result = list_accounts()
        else:
            result = login_result
    elif action == "portfolio":
        # Need to be logged in first
        login_result = login()
        if login_result.get("status") == "authenticated":
            result = get_portfolio()
        else:
            result = login_result
    else:
        print(f"Unknown action: {action}")
        print(__doc__)
        sys.exit(1)

    # Output as JSON
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
