"""Retry utilities for handling transient Supabase connection errors"""

import logging
import time
import asyncio
from typing import Callable, TypeVar, Any
from functools import wraps
from httpx import RemoteProtocolError, ConnectError, TimeoutException

logger = logging.getLogger(__name__)

T = TypeVar('T')

# Supabase connection errors that should be retried
RETRYABLE_EXCEPTIONS = (
    RemoteProtocolError,
    ConnectError,
    TimeoutException,
    ConnectionError,
    OSError,
)


def retry_supabase_operation(
    max_retries: int = 3,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    retryable_exceptions: tuple = RETRYABLE_EXCEPTIONS,
):
    """
    Decorator to retry Supabase operations on connection errors.
    
    Args:
        max_retries: Maximum number of retry attempts (default: 3)
        initial_delay: Initial delay in seconds before first retry (default: 0.5)
        backoff_factor: Multiplier for delay between retries (default: 2.0)
        retryable_exceptions: Tuple of exception types to retry on
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            f"Supabase connection error in {func.__name__} (attempt {attempt + 1}/{max_retries + 1}): {str(e)}. "
                            f"Retrying in {delay:.2f}s..."
                        )
                        time.sleep(delay)
                        delay *= backoff_factor
                    else:
                        logger.error(
                            f"Supabase connection error in {func.__name__} after {max_retries + 1} attempts: {str(e)}"
                        )
                except Exception as e:
                    # Don't retry on non-connection errors
                    logger.error(f"Non-retryable error in {func.__name__}: {str(e)}")
                    raise
            
            # If we exhausted all retries, raise the last exception
            if last_exception:
                raise last_exception
            
            # This should never be reached, but just in case
            raise RuntimeError(f"Unexpected error in {func.__name__}")
        
        return wrapper
    return decorator


async def retry_supabase_operation_async(
    max_retries: int = 3,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    retryable_exceptions: tuple = RETRYABLE_EXCEPTIONS,
):
    """
    Async decorator to retry Supabase operations on connection errors.
    
    Args:
        max_retries: Maximum number of retry attempts (default: 3)
        initial_delay: Initial delay in seconds before first retry (default: 0.5)
        backoff_factor: Multiplier for delay between retries (default: 2.0)
        retryable_exceptions: Tuple of exception types to retry on
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            f"Supabase connection error in {func.__name__} (attempt {attempt + 1}/{max_retries + 1}): {str(e)}. "
                            f"Retrying in {delay:.2f}s..."
                        )
                        await asyncio.sleep(delay)
                        delay *= backoff_factor
                    else:
                        logger.error(
                            f"Supabase connection error in {func.__name__} after {max_retries + 1} attempts: {str(e)}"
                        )
                except Exception as e:
                    # Don't retry on non-connection errors
                    logger.error(f"Non-retryable error in {func.__name__}: {str(e)}")
                    raise
            
            # If we exhausted all retries, raise the last exception
            if last_exception:
                raise last_exception
            
            # This should never be reached, but just in case
            raise RuntimeError(f"Unexpected error in {func.__name__}")
        
        return wrapper
    return decorator
