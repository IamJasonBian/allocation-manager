#!/bin/bash
# Robinhood Function Test Script
# Usage: ./scripts/test-robinhood.sh [action] [options]
#
# Authentication uses Python robin_stocks library (handles MFA properly).
# Netlify functions read the token from the Python session file.

BASE_URL="${RH_TEST_URL:-http://localhost:3000}"
PORTFOLIO_URL="$BASE_URL/.netlify/functions/robinhood-portfolio"
BOT_URL="$BASE_URL/.netlify/functions/robinhood-bot"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_AUTH="$SCRIPT_DIR/rh_auth.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Pretty print JSON
pretty_json() {
    if command -v python3 &> /dev/null; then
        python3 -m json.tool 2>/dev/null || cat
    else
        cat
    fi
}

# Check if server is running
check_server() {
    if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
        print_error "Server not running at $BASE_URL"
        echo "Start the server with: npm run dev:clean"
        echo "Or for local functions only: npm run functions"
        exit 1
    fi
    print_success "Server is running at $BASE_URL"
}

# ============================================
# Python Auth Commands (no server needed)
# ============================================

# Main auth command - uses Python robin_stocks
auth() {
    print_header "Python Authentication (robin_stocks)"
    print_info "Running: python3 $PYTHON_AUTH auth"
    python3 "$PYTHON_AUTH" auth
}

py_status() {
    print_header "Python Auth Status"
    print_info "Running: python3 $PYTHON_AUTH status"
    python3 "$PYTHON_AUTH" status
}

py_logout() {
    print_header "Python Logout"
    print_info "Running: python3 $PYTHON_AUTH logout"
    python3 "$PYTHON_AUTH" logout
}

py_accounts() {
    print_header "Python List Accounts"
    print_info "Running: python3 $PYTHON_AUTH accounts"
    python3 "$PYTHON_AUTH" accounts
}

py_portfolio() {
    print_header "Python Portfolio"
    print_info "Running: python3 $PYTHON_AUTH portfolio"
    python3 "$PYTHON_AUTH" portfolio
}

# ============================================
# API Commands (need server running)
# ============================================

status() {
    print_header "API Auth Status"
    print_info "GET $PORTFOLIO_URL?action=status"
    curl -s "$PORTFOLIO_URL?action=status" | pretty_json
}

portfolio() {
    print_header "Fetching Portfolio via API"
    print_info "GET $PORTFOLIO_URL?action=portfolio"
    curl -s "$PORTFOLIO_URL?action=portfolio" | pretty_json
}

orders() {
    print_header "Fetching Recent Orders"
    print_info "GET $PORTFOLIO_URL?action=orders"
    curl -s "$PORTFOLIO_URL?action=orders" | pretty_json
}

bot_status() {
    print_header "Bot Status"
    print_info "GET $BOT_URL?action=status"
    curl -s "$BOT_URL?action=status" | pretty_json
}

bot_actions() {
    local limit=${1:-10}
    print_header "Bot Actions (limit: $limit)"
    print_info "GET $BOT_URL?action=actions&limit=$limit"
    curl -s "$BOT_URL?action=actions&limit=$limit" | pretty_json
}

quote() {
    local symbol=$1
    if [ -z "$symbol" ]; then
        print_error "Symbol required. Usage: $0 quote <symbol>"
        exit 1
    fi
    print_header "Quote for $symbol"
    print_info "GET $BOT_URL?action=quote&symbol=$symbol"
    curl -s "$BOT_URL?action=quote&symbol=$symbol" | pretty_json
}

analyze() {
    print_header "Analyzing Portfolio"
    print_info "GET $BOT_URL?action=analyze"
    curl -s "$BOT_URL?action=analyze" | pretty_json
}

# Help
usage() {
    echo "Robinhood Function Test Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Authentication (Python - no server needed):"
    echo "  auth          Login with MFA support (interactive)"
    echo "  py-status     Check Python auth status"
    echo "  py-logout     Logout from Python session"
    echo "  py-accounts   List accounts via Python"
    echo "  py-portfolio  Get portfolio via Python"
    echo ""
    echo "API Commands (requires server: npm run dev:clean or npm run functions):"
    echo "  status        Check API auth status"
    echo "  portfolio     Fetch portfolio data"
    echo "  orders        Fetch recent orders"
    echo "  bot-status    Get bot status"
    echo "  bot-actions [limit]  Get bot action log"
    echo "  quote <symbol>  Get quote for symbol"
    echo "  analyze       Analyze portfolio"
    echo ""
    echo "Environment Variables:"
    echo "  RH_TEST_URL   Base URL (default: http://localhost:3000)"
    echo ""
    echo "Workflow:"
    echo "  1. Run '$0 auth' to authenticate (once, session is cached)"
    echo "  2. Start server: 'npm run dev:clean' or 'npm run functions'"
    echo "  3. Use API commands: '$0 portfolio', '$0 quote AAPL', etc."
    echo ""
    echo "Examples:"
    echo "  $0 auth               # Login with MFA"
    echo "  $0 py-portfolio       # Get portfolio directly via Python"
    echo "  $0 status             # Check if API can use Python session"
    echo "  $0 portfolio          # Get portfolio via API"
    echo "  $0 quote AAPL         # Get Apple quote"
    echo "  $0 analyze            # Analyze portfolio with bot"
}

# Main
case "$1" in
    # Python auth commands (no server needed)
    auth)        auth ;;
    py-auth)     auth ;;
    py-status)   py_status ;;
    py-logout)   py_logout ;;
    py-accounts) py_accounts ;;
    py-portfolio) py_portfolio ;;

    # API commands (need server)
    status)      check_server && status ;;
    portfolio)   check_server && portfolio ;;
    orders)      check_server && orders ;;
    bot-status)  check_server && bot_status ;;
    bot-actions) check_server && bot_actions "$2" ;;
    quote)       check_server && quote "$2" ;;
    analyze)     check_server && analyze ;;

    help|--help|-h|"")
        usage ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        usage
        exit 1 ;;
esac
