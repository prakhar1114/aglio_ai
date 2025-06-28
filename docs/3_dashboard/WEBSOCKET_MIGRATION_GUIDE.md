# WebSocket Dashboard Migration Guide

## Quick Start

The admin dashboard now uses WebSockets for real-time updates instead of HTMX polling.

### What Changed

- **Before**: Dashboard polled `/admin/tables` every 30 seconds
- **After**: Dashboard connects to `/admin/ws/dashboard` WebSocket for instant updates

### Testing the Implementation

1. **Start the server**:
   ```bash
   cd backend
   python main.py
   ```

2. **Access the dashboard**:
   - Go to `http://localhost:8005/admin/login`
   - Enter a valid API key
   - Dashboard will automatically connect via WebSocket

3. **Verify WebSocket connection**:
   - Open browser dev tools → Network tab → WS filter
   - Should see active WebSocket connection to `/admin/ws/dashboard`
   - Connection status shows in console logs

### Features Working

✅ **Real-time table updates**
- Open multiple dashboard tabs
- Change table status in one tab
- See instant updates in all other tabs

✅ **All table operations**
- Close table sessions
- Disable/enable tables  
- Move parties between tables
- Restore previous sessions

✅ **Connection resilience**
- Automatic reconnection on network issues
- Exponential backoff retry logic
- Graceful error handling

### Fallback Behavior

If WebSocket fails:
- Dashboard shows connection error
- Attempts automatic reconnection
- Manual refresh still works as fallback

### REST API Compatibility

- All existing REST endpoints still work
- Marked as `deprecated=True` in OpenAPI docs
- Can be used alongside WebSocket implementation

### Troubleshooting

**WebSocket connection fails**:
- Check API key is valid
- Verify server supports WebSocket upgrades
- Check proxy configuration (if using reverse proxy)

**Dashboard not updating**:
- Check browser console for WebSocket errors
- Verify token authentication
- Try refreshing the page

**Performance issues**:
- Monitor connection count per restaurant
- Check server logs for WebSocket errors
- Verify database performance on table queries

### Browser Support

- Modern browsers with WebSocket support
- Chrome 16+, Firefox 11+, Safari 7+, Edge 12+
- Mobile browsers supported

### Production Deployment

Ensure your reverse proxy supports WebSocket upgrades:

**Nginx**:
```nginx
location /admin/ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

**Cloudflare**: WebSocket support is automatic for Pro+ plans

This implementation provides better performance and user experience while maintaining full backward compatibility. 