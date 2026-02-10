"""
ZF A2A MCP package.

This package exposes a canonical MCP server implementation that acts as
a deterministic tool bus for multi-agent environments.
"""

from .server import MCPServer, create_server

__all__ = ["MCPServer", "create_server"]
``
