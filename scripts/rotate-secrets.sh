#!/bin/bash

# ============================================
# SECRET ROTATION AUTOMATION SCRIPT
# ============================================
#
# Automates rotation of critical secrets for Food Waste Backend
#
# Usage:
#   ./scripts/rotate-secrets.sh [service]
#
# Services:
#   all          - Rotate all secrets
#   jwt          - Rotate JWT secrets only
#   database     - Rotate database credentials
#   redis        - Rotate Redis password
#   smtp         - Rotate SMTP password
#
# Requirements:
#   - gh CLI (for GitHub Secrets)
#   - aws CLI (for AWS Secrets Manager)
#   - node (for crypto generation)
#   - mongosh (for MongoDB)
#   - redis-cli (for Redis)
# ============================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
SECRETS_MANAGER="${SECRETS_MANAGER:-github}" # github | aws | vault

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."

    # Check for required commands
    local required_commands=("node" "gh" "git")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd is not installed"
            exit 1
        fi
    done

    log_info "All requirements met"
}

generate_secret() {
    local length=$1
    node -e "console.log(require('crypto').randomBytes(${length}).toString('hex'))"
}

backup_current_secrets() {
    log_info "Backing up current secrets..."

    local backup_dir="backups/secrets-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    # Export current secrets (masked)
    gh secret list > "$backup_dir/secret-list.txt" 2>/dev/null || true

    log_info "Backup saved to $backup_dir"
}

rotate_jwt_secrets() {
    log_info "Rotating JWT secrets..."

    # Generate new secrets (64 bytes = 128 hex chars)
    local new_jwt_secret=$(generate_secret 64)
    local new_refresh_secret=$(generate_secret 64)

    log_info "Generated new JWT secrets"

    # Update secrets based on manager
    case $SECRETS_MANAGER in
        github)
            gh secret set JWT_SECRET --body "$new_jwt_secret"
            gh secret set JWT_REFRESH_SECRET --body "$new_refresh_secret"
            log_info "Updated GitHub Secrets"
            ;;
        aws)
            aws secretsmanager update-secret \
                --secret-id "foodwaste/${ENVIRONMENT}/jwt-secret" \
                --secret-string "$new_jwt_secret"
            aws secretsmanager update-secret \
                --secret-id "foodwaste/${ENVIRONMENT}/jwt-refresh-secret" \
                --secret-string "$new_refresh_secret"
            log_info "Updated AWS Secrets Manager"
            ;;
        vault)
            vault kv put "secret/foodwaste/${ENVIRONMENT}" \
                jwt_secret="$new_jwt_secret" \
                jwt_refresh_secret="$new_refresh_secret"
            log_info "Updated HashiCorp Vault"
            ;;
    esac

    log_warn "JWT secrets rotated. All user sessions will be invalidated."
    log_warn "Users will need to re-authenticate."
}

rotate_database_credentials() {
    log_info "Rotating database credentials..."

    log_warn "Database credential rotation requires manual intervention:"
    log_warn "1. Log in to MongoDB Atlas (https://cloud.mongodb.com/)"
    log_warn "2. Navigate to Database Access"
    log_warn "3. Create new user with strong password"
    log_warn "4. Update DATABASE_URL secret"
    log_warn "5. Delete old user"

    read -p "Have you completed these steps? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_error "Database rotation cancelled"
        exit 1
    fi

    log_info "Database credentials rotated"
}

rotate_redis_password() {
    log_info "Rotating Redis password..."

    log_warn "Redis password rotation requires manual intervention:"
    log_warn "1. Log in to Redis Cloud (https://app.redislabs.com/)"
    log_warn "2. Navigate to your database"
    log_warn "3. Security > Reset Password"
    log_warn "4. Copy new password"

    read -p "Enter new Redis password: " -s new_redis_password
    echo

    if [[ -z "$new_redis_password" ]]; then
        log_error "Redis password cannot be empty"
        exit 1
    fi

    # Update secret
    case $SECRETS_MANAGER in
        github)
            gh secret set REDIS_PASSWORD --body "$new_redis_password"
            ;;
        aws)
            aws secretsmanager update-secret \
                --secret-id "foodwaste/${ENVIRONMENT}/redis-password" \
                --secret-string "$new_redis_password"
            ;;
    esac

    log_info "Redis password rotated"
}

rotate_smtp_password() {
    log_info "Rotating SMTP password..."

    log_warn "SMTP password rotation requires manual intervention:"
    log_warn "1. Log in to Google Account"
    log_warn "2. Navigate to App Passwords (https://myaccount.google.com/apppasswords)"
    log_warn "3. Revoke old app password"
    log_warn "4. Generate new app password"

    read -p "Enter new SMTP password: " -s new_smtp_password
    echo

    if [[ -z "$new_smtp_password" ]]; then
        log_error "SMTP password cannot be empty"
        exit 1
    fi

    # Update secret
    case $SECRETS_MANAGER in
        github)
            gh secret set SMTP_PASS --body "$new_smtp_password"
            ;;
        aws)
            aws secretsmanager update-secret \
                --secret-id "foodwaste/${ENVIRONMENT}/smtp-password" \
                --secret-string "$new_smtp_password"
            ;;
    esac

    log_info "SMTP password rotated"
}

trigger_deployment() {
    log_info "Triggering deployment with new secrets..."

    # Trigger GitHub Actions workflow
    gh workflow run deploy.yml \
        --field environment="$ENVIRONMENT" \
        || log_warn "Could not trigger automatic deployment"

    log_warn "Manual deployment may be required"
    log_warn "Run: kubectl rollout restart deployment/foodwaste-backend"
}

verify_secrets() {
    log_info "Verifying secret rotation..."

    case $SECRETS_MANAGER in
        github)
            log_info "GitHub Secrets:"
            gh secret list
            ;;
        aws)
            log_info "AWS Secrets:"
            aws secretsmanager list-secrets \
                --filters "Key=name,Values=foodwaste/${ENVIRONMENT}"
            ;;
    esac

    log_info "Verification complete"
}

# Main script
main() {
    local service="${1:-all}"

    echo "================================================"
    echo "SECRET ROTATION SCRIPT"
    echo "================================================"
    echo "Environment: $ENVIRONMENT"
    echo "Secrets Manager: $SECRETS_MANAGER"
    echo "Service: $service"
    echo "================================================"
    echo

    check_requirements
    backup_current_secrets

    case $service in
        all)
            rotate_jwt_secrets
            rotate_database_credentials
            rotate_redis_password
            rotate_smtp_password
            ;;
        jwt)
            rotate_jwt_secrets
            ;;
        database)
            rotate_database_credentials
            ;;
        redis)
            rotate_redis_password
            ;;
        smtp)
            rotate_smtp_password
            ;;
        *)
            log_error "Unknown service: $service"
            echo "Usage: $0 [all|jwt|database|redis|smtp]"
            exit 1
            ;;
    esac

    trigger_deployment
    verify_secrets

    echo
    echo "================================================"
    echo "SECRET ROTATION COMPLETE"
    echo "================================================"
    echo
    log_warn "IMPORTANT: Monitor application for issues"
    log_warn "IMPORTANT: Update documentation with rotation date"
}

# Run main function
main "$@"
