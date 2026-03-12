from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
import os
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class WalletManager:
    """Manages wallet connections and Web3 interactions"""
    
    def __init__(self, rpc_url: str):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            logger.warning(f"Failed to connect to blockchain at {rpc_url}")
    
    def verify_signature(self, message: str, signature: str, address: str) -> bool:
        """Verify that a message was signed by the given address"""
        try:
            message_hash = encode_defunct(text=message)
            recovered_address = Account.recover_message(
                message_hash, 
                signature=signature
            )
            return recovered_address.lower() == address.lower()
        except Exception as e:
            logger.error(f"Signature verification failed: {e}")
            return False
    
    def get_balance(self, address: str) -> Tuple[float, int]:
        """Get MATIC balance for an address"""
        try:
            wei_balance = self.w3.eth.get_balance(address)
            matic_balance = self.w3.from_wei(wei_balance, 'ether')
            return float(matic_balance), int(wei_balance)
        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            return 0.0, 0
    
    def is_valid_address(self, address: str) -> bool:
        """Check if address is valid"""
        return Web3.is_address(address)
    
    def get_transaction_status(self, tx_hash: str) -> dict:
        """Get current status of a transaction"""
        try:
            tx = self.w3.eth.get_transaction(tx_hash)
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            
            return {
                "status": "success" if receipt.status == 1 else "failed",
                "block_number": receipt.blockNumber,
                "gas_used": receipt.gasUsed,
                "confirmations": self.w3.eth.block_number - receipt.blockNumber
            }
        except Exception as e:
            return {"status": "pending", "error": str(e)}
    
    def is_connected(self) -> bool:
        """Check if connected to blockchain"""
        return self.w3.is_connected()