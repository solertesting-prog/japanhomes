#!/usr/bin/env python3
"""
Backend API Testing for Japanese Property Tokenization Platform
Tests all API endpoints defined in the backend routes
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any

class JapanesePropertyAPITester:
    def __init__(self, base_url="https://property-exchange-jp.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name: str, success: bool, message: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        if response_data:
            result["response_sample"] = str(response_data)[:200]  # Truncate for readability
        
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, data: Dict = None, params: Dict = None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if not endpoint.startswith('/') else f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                self.log_result(name, False, f"Unsupported method: {method}")
                return False, {}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text[:200]}
            
            if success:
                self.log_result(name, True, f"Status: {response.status_code}", response_data)
            else:
                self.log_result(name, False, f"Expected {expected_status}, got {response.status_code}. Response: {response.text[:200]}")

            return success, response_data

        except requests.exceptions.RequestException as e:
            self.log_result(name, False, f"Request error: {str(e)}")
            return False, {}
        except Exception as e:
            self.log_result(name, False, f"Unexpected error: {str(e)}")
            return False, {}

    # Properties API Tests
    def test_get_all_properties(self):
        """Test GET /properties/ - should return all properties"""
        success, data = self.run_test(
            "Get All Properties",
            "GET", 
            "/properties/",
            200
        )
        if success and isinstance(data, list):
            self.log_result("Properties Count", True, f"Found {len(data)} properties")
            return data
        return []

    def test_get_featured_properties(self):
        """Test GET /properties/featured/list/ - should return featured properties"""
        success, data = self.run_test(
            "Get Featured Properties",
            "GET",
            "/properties/featured/list/",
            200
        )
        if success and isinstance(data, list):
            self.log_result("Featured Properties Count", True, f"Found {len(data)} featured properties")
            return data
        return []

    def test_get_property_by_id(self, property_id: str):
        """Test GET /properties/{id}/ - should return single property"""
        success, data = self.run_test(
            f"Get Property by ID",
            "GET",
            f"/properties/{property_id}/",
            200
        )
        return success, data

    def test_property_filters(self):
        """Test property filtering functionality"""
        # Test city filter
        self.run_test(
            "Filter Properties by City (Tokyo)",
            "GET",
            "/properties/",
            200,
            params={"city": "Tokyo"}
        )
        
        # Test property type filter
        self.run_test(
            "Filter Properties by Type (apartment)",
            "GET", 
            "/properties/",
            200,
            params={"property_type": "apartment"}
        )
        
        # Test status filter
        self.run_test(
            "Filter Properties by Status (active)",
            "GET",
            "/properties/",
            200,
            params={"status": "active"}
        )

    def test_invalid_property_id(self):
        """Test GET /properties/{invalid_id}/ - should return 404"""
        self.run_test(
            "Get Invalid Property ID",
            "GET",
            "/properties/invalid-property-id/",
            404
        )

    # Admin API Tests (expect 422/401 since we don't have auth)
    def test_admin_endpoints(self):
        """Test admin endpoints - expect authentication errors"""
        self.run_test(
            "Get Analytics (No Auth)",
            "GET",
            "/admin/analytics/",
            422  # Expecting validation error or auth error
        )
        
        self.run_test(
            "Get All Users (No Auth)",
            "GET", 
            "/admin/users/",
            422
        )
        
        self.run_test(
            "Get KYC Requests (No Auth)",
            "GET",
            "/admin/kyc-requests/",
            422
        )

    # KYC API Tests
    def test_kyc_endpoints(self):
        """Test KYC endpoints"""
        # Test KYC status for non-existent wallet
        self.run_test(
            "Get KYC Status (Non-existent wallet)",
            "GET",
            "/kyc/status/0x1234567890abcdef/",
            404  # Should not find the wallet
        )

    # Transaction API Tests
    def test_transaction_endpoints(self):
        """Test transaction endpoints"""
        # Test portfolio for non-existent wallet
        self.run_test(
            "Get Portfolio (Non-existent wallet)", 
            "GET",
            "/transactions/portfolio/0x1234567890abcdef/",
            200  # Should return empty portfolio
        )
        
        # Test wallet transactions
        self.run_test(
            "Get Wallet Transactions (Non-existent wallet)",
            "GET",
            "/transactions/wallet/0x1234567890abcdef/", 
            200  # Should return empty list
        )

    def test_health_check(self):
        """Test if backend is responding"""
        try:
            response = requests.get(self.base_url.replace('/api', ''), timeout=10)
            if response.status_code == 200:
                self.log_result("Backend Health Check", True, "Backend is responding")
                return True
            else:
                self.log_result("Backend Health Check", False, f"Backend returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Backend Health Check", False, f"Backend not responding: {str(e)}")
            return False

    def run_comprehensive_test(self):
        """Run all tests"""
        print(f"🚀 Starting comprehensive API testing for Japanese Property Platform")
        print(f"🔗 Backend URL: {self.base_url}")
        print("=" * 80)

        # Health check first
        if not self.test_health_check():
            print("❌ Backend health check failed. Stopping tests.")
            return self.generate_report()

        # Test properties endpoints
        print("\n📦 Testing Properties API...")
        properties = self.test_get_all_properties()
        featured_properties = self.test_get_featured_properties()
        
        # Test individual property if we have data
        if properties and len(properties) > 0:
            first_property = properties[0]
            if isinstance(first_property, dict) and 'id' in first_property:
                self.test_get_property_by_id(first_property['id'])
        
        # Test property filters
        self.test_property_filters()
        
        # Test invalid cases
        self.test_invalid_property_id()
        
        # Test other endpoints
        print("\n🔐 Testing Admin API (expect auth errors)...")
        self.test_admin_endpoints()
        
        print("\n📋 Testing KYC API...")
        self.test_kyc_endpoints()
        
        print("\n💰 Testing Transaction API...")
        self.test_transaction_endpoints()

        return self.generate_report()

    def generate_report(self):
        """Generate final test report"""
        print("\n" + "=" * 80)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 80)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"✅ Tests Passed: {self.tests_passed}/{self.tests_run} ({success_rate:.1f}%)")
        
        # Count failed tests
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['message']}")
        
        # Critical endpoints check
        critical_endpoints = [
            "Get All Properties",
            "Get Featured Properties", 
            "Backend Health Check"
        ]
        
        critical_passed = sum(1 for r in self.test_results if r['test'] in critical_endpoints and r['success'])
        print(f"\n🎯 Critical Endpoints: {critical_passed}/{len(critical_endpoints)} passing")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": len(failed_tests),
            "success_rate": success_rate,
            "critical_endpoints_passing": critical_passed == len(critical_endpoints),
            "test_details": self.test_results
        }

def main():
    """Main test execution"""
    tester = JapanesePropertyAPITester()
    
    try:
        report = tester.run_comprehensive_test()
        
        # Determine exit code
        if report['success_rate'] >= 70 and report['critical_endpoints_passing']:
            print("\n🎉 Backend API testing completed successfully!")
            return 0
        else:
            print("\n⚠️ Backend API testing completed with issues.")
            return 1
            
    except Exception as e:
        print(f"\n💥 Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())