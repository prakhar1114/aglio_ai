#!/usr/bin/env python3
"""
Simple test script for table session functionality
"""

import sys
sys.path.append('..')

from utils.jwt_utils import encode_ws_token, decode_ws_token, is_token_near_expiry, create_qr_token, verify_qr_token
from utils.nickname_generator import generate_nickname
import time

def test_jwt_functions():
    """Test JWT encoding/decoding"""
    print("Testing JWT functions...")
    
    # Test token creation
    member_pid = "m_test123"
    session_pid = "s_test456" 
    device_id = "device_test789"
    
    token = encode_ws_token(member_pid, session_pid, device_id)
    print(f"Generated token: {token[:50]}...")
    
    # Test token decoding
    payload = decode_ws_token(token)
    print(f"Decoded payload: {payload}")
    
    assert payload["sub"] == member_pid
    assert payload["sid"] == session_pid
    assert payload["dev"] == device_id
    print("✅ JWT encoding/decoding works!")
    
    # Test expiry check
    is_near_expiry = is_token_near_expiry(token, minutes=180)  # 3 hours
    print(f"Token near expiry (3h): {is_near_expiry}")
    assert is_near_expiry == False  # Should not be near expiry for new token
    print("✅ JWT expiry check works!")

def test_qr_token_functions():
    """Test QR token creation/verification"""
    print("\nTesting QR token functions...")
    
    restaurant_id = 1
    table_id = 5
    
    token = create_qr_token(restaurant_id, table_id)
    print(f"Generated QR token: {token}")
    
    # Test verification
    is_valid = verify_qr_token(restaurant_id, table_id, token)
    print(f"Token verification: {is_valid}")
    assert is_valid == True
    
    # Test invalid token
    is_invalid = verify_qr_token(restaurant_id, table_id, "invalid_token")
    print(f"Invalid token verification: {is_invalid}")
    assert is_invalid == False
    
    print("✅ QR token creation/verification works!")

def test_nickname_generator():
    """Test nickname generation"""
    print("\nTesting nickname generator...")
    
    nicknames = set()
    for i in range(10):
        nickname = generate_nickname()
        print(f"Generated nickname {i+1}: {nickname}")
        nicknames.add(nickname)
    
    print(f"Generated {len(nicknames)} unique nicknames out of 10")
    print("✅ Nickname generator works!")

if __name__ == "__main__":
    try:
        test_jwt_functions()
        test_qr_token_functions()
        test_nickname_generator()
        print("\n🎉 All tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1) 