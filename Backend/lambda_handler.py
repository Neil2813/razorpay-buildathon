"""
GlassBox Backend -- AWS Lambda Handler Entry Point.

Wraps the FastAPI application using Mangum for AWS Lambda and API Gateway / Function URL execution.
Includes automatic runtime detection and graceful local fallback.
"""

import logging
from main import create_app, app as fastapi_app

logger = logging.getLogger("glassbox.lambda")

try:
    from mangum import Mangum
    handler = Mangum(fastapi_app, api_gateway_base_path="/")
    logger.info("Successfully initialized Mangum handler for AWS Lambda execution.")
except ImportError:
    logger.warning("Mangum is not installed in local environment. AWS Lambda handler operating in fallback mode.")
    def handler(event, context):
        """Fallback lambda handler for environments without mangum pre-installed."""
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": '{"error": "Mangum dependency missing in Lambda environment.", "mode": "local_fallback"}'
        }
