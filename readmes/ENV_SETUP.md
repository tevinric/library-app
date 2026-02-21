# Environment Configuration Guide

## ENV_TYPE Variable

The `VITE_ZOELIBRARYAPP_ENV_TYPE` variable controls the authentication mode for the Library Management application.

### Configuration Options

**Option 1: Development Mode (No Authentication Required)**
```bash
# In frontend/.env
VITE_ZOELIBRARYAPP_ENV_TYPE=DEV
VITE_ZOELIBRARYAPP_DEV_USER_EMAIL=dev@library.local
```

- **Use When**: Local development, testing, demo purposes
- **Behavior**:
  - Bypasses Azure AD authentication completely
  - Automatically logs in as development user
  - Shows "DEV MODE" badge in UI
  - Uses email from `VITE_DEV_USER_EMAIL`
- **Benefits**:
  - No Azure AD setup required
  - Instant access for testing
  - Faster development iteration

**Option 2: Production Mode (Azure AD Authentication)**
```bash
# In frontend/.env
VITE_ZOELIBRARYAPP_ENV_TYPE=PROD
VITE_ZOELIBRARYAPP_AZURE_CLIENT_ID=your-azure-client-id
VITE_ZOELIBRARYAPP_AZURE_TENANT_ID=your-azure-tenant-id
VITE_ZOELIBRARYAPP_AZURE_REDIRECT_URI=http://localhost:3002
VITE_ZOELIBRARYAPP_AZURE_REQUIRED_GROUP_ID=your-security-group-id
```

- **Use When**: Production deployment, team access control
- **Behavior**:
  - Full Azure AD (Entra) authentication
  - Group membership validation
  - Proper access control
  - No dev mode indicators
- **Requirements**:
  - Azure AD app registration
  - Security group configured
  - Users added to security group

## Quick Start Examples

### For Local Development (Recommended)

1. Edit `frontend/.env`:
```bash
VITE_ZOELIBRARYAPP_ENV_TYPE=DEV
VITE_ZOELIBRARYAPP_DEV_USER_EMAIL=dev@library.local
VITE_ZOELIBRARYAPP_API_URL=http://localhost:5002
VITE_ZOELIBRARYAPP_DEV_PORT=3000
```

2. Start the application:
```bash
./setup.sh
```

3. Access at http://localhost:3002
   - No login screen
   - Automatic authentication
   - Immediate access to all features

### For Production Deployment

1. Register Azure AD Application:
   - Go to Azure Portal → Azure Active Directory
   - App registrations → New registration
   - Name: "Library Management"
   - Redirect URI: Your production URL

2. Configure API Permissions:
   - Microsoft Graph → Delegated permissions
   - Add: `User.Read`, `GroupMember.Read.All`
   - Grant admin consent

3. Create Security Group:
   - Azure AD → Groups → New group
   - Add authorized users
   - Copy the Object ID

4. Update `frontend/.env`:
```bash
VITE_ZOELIBRARYAPP_ENV_TYPE=PROD
VITE_ZOELIBRARYAPP_AZURE_CLIENT_ID=<your-client-id>
VITE_ZOELIBRARYAPP_AZURE_TENANT_ID=<your-tenant-id>
VITE_ZOELIBRARYAPP_AZURE_REDIRECT_URI=https://your-domain.com
VITE_ZOELIBRARYAPP_AZURE_REQUIRED_GROUP_ID=<your-group-object-id>
```

5. Rebuild and deploy:
```bash
docker-compose build frontend --no-cache
docker-compose up -d
```

## Environment Variables Reference

### Required for DEV Mode
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_ZOELIBRARYAPP_ENV_TYPE` | Environment type | `DEV` |
| `VITE_ZOELIBRARYAPP_DEV_USER_EMAIL` | Dev user email | `dev@library.local` |
| `VITE_ZOELIBRARYAPP_API_URL` | Backend API URL | `http://localhost:5002` |

### Required for PROD Mode
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_ZOELIBRARYAPP_ENV_TYPE` | Environment type | `PROD` |
| `VITE_ZOELIBRARYAPP_AZURE_CLIENT_ID` | Azure AD App Client ID | `abc123...` |
| `VITE_ZOELIBRARYAPP_AZURE_TENANT_ID` | Azure AD Tenant ID | `def456...` |
| `VITE_ZOELIBRARYAPP_AZURE_REDIRECT_URI` | OAuth redirect URI | `https://app.com` |
| `VITE_ZOELIBRARYAPP_AZURE_REQUIRED_GROUP_ID` | Security group Object ID | `ghi789...` |
| `VITE_ZOELIBRARYAPP_API_URL` | Backend API URL | `https://api.app.com` |

## Visual Indicators

### DEV Mode
- Yellow "DEV MODE" badge in sidebar
- Yellow "DEV MODE" badge in mobile header
- User shown as configured dev email
- No login screen

### PROD Mode
- No dev mode indicators
- Microsoft login screen on first access
- User shown as Azure AD email
- Access denied screen if not in security group

## Switching Between Modes

### From PROD to DEV
1. Edit `frontend/.env`
2. Change `VITE_ZOELIBRARYAPP_ENV_TYPE=PROD` to `VITE_ZOELIBRARYAPP_ENV_TYPE=DEV`
3. Rebuild frontend:
```bash
cd frontend
npm run build
# OR if using Docker:
cd ..
docker-compose build frontend --no-cache
docker-compose restart frontend
```

### From DEV to PROD
1. Ensure Azure AD is configured (see Production Deployment above)
2. Edit `frontend/.env`
3. Change `VITE_ZOELIBRARYAPP_ENV_TYPE=DEV` to `VITE_ZOELIBRARYAPP_ENV_TYPE=PROD`
4. Fill in all Azure variables
5. Rebuild frontend (same as above)

## Backend Considerations

The backend always accepts the `X-User-Email` header for authentication. The mode only affects the frontend behavior:

- **DEV mode**: Frontend automatically sends `dev@library.local` (or configured email)
- **PROD mode**: Frontend sends the authenticated Azure AD user's email

The backend will auto-create users in the database on first API call, regardless of mode.

## Security Notes

### DEV Mode Security
⚠️ **NEVER use DEV mode in production!**
- No authentication or authorization
- Any user can access with any email
- Intended for local development only

### PROD Mode Security
✅ Recommended for production:
- Full Azure AD authentication
- Group-based access control
- Proper user identity tracking
- Audit trail with real user emails

## Troubleshooting

### DEV Mode Issues

**Issue**: Still seeing login screen
```bash
# Solution: Clear browser cache and localStorage
# In browser console:
localStorage.clear()
# Then refresh page
```

**Issue**: API returns 401 errors
```bash
# Check that userEmail is set
# In browser console:
console.log(localStorage.getItem('userEmail'))
# Should show: dev@library.local
```

### PROD Mode Issues

**Issue**: Access denied after login
```bash
# Verify user is in the security group
# Check VITE_AZURE_REQUIRED_GROUP_ID matches group Object ID
```

**Issue**: Login popup blocked
```bash
# Enable popups for your domain
# Or use redirect flow instead of popup
```

## Best Practices

1. **Use DEV mode for**:
   - Local development
   - Testing new features
   - Demos and presentations
   - CI/CD automated testing

2. **Use PROD mode for**:
   - Production deployments
   - Staging environments
   - Team collaboration
   - Any public-facing instance

3. **Never commit**:
   - Real Azure credentials to git
   - Production .env files
   - Access tokens or secrets

4. **Always use**:
   - Environment-specific .env files
   - Secrets management in production
   - HTTPS in production

## Example Workflows

### Local Development Workflow
```bash
# 1. Set to DEV mode
echo "VITE_ZOELIBRARYAPP_ENV_TYPE=DEV" > frontend/.env

# 2. Start services
./setup.sh

# 3. Develop and test
# Access http://localhost:3002
# Automatic login as dev user

# 4. Test features
# All API calls use dev@library.local
```

### Production Deployment Workflow
```bash
# 1. Configure Azure AD
# (See production setup above)

# 2. Set to PROD mode
# Update frontend/.env with Azure credentials
VITE_ZOELIBRARYAPP_ENV_TYPE=PROD

# 3. Build and deploy
docker-compose build
docker-compose up -d

# 4. Verify authentication
# Access production URL
# Should see Microsoft login
# Only authorized users can access
```

---

For more information, see:
- README.md - Complete application documentation
- QUICKSTART.md - Quick start guide
- setup.sh - Automated setup script
