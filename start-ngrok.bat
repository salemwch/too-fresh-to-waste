@echo off
REM ========================================
REM ngrok Tunnel Startup Script
REM Exposes local backend on HTTPS for email testing
REM ========================================

echo.
echo ============================================
echo Starting ngrok tunnel for Food Waste Backend
echo ============================================
echo.
echo IMPORTANT: Copy the HTTPS URL from below and update:
echo   1. apps/food-waste-backend/.env - FRONTEND_URL
echo   2. apps/mobile/.env - API_BASE_URL and WEBSOCKET_URL
echo.
echo Press Ctrl+C to stop ngrok when done testing
echo ============================================
echo.

REM Start ngrok on port 3000
ngrok http 3000

REM Note: This script will keep running until you press Ctrl+C
