# Troubleshooting OpenLibrary Integration

## Quick Debug Steps

### 1. Test OpenLibrary API Directly

Open the test file in your browser:
```bash
# Navigate to the guides folder
cd /media/tevinric/Github4/library-app/guides

# Open the test HTML file in your browser
# For example, in Chrome:
google-chrome test_openlibrary_api.html

# Or Firefox:
firefox test_openlibrary_api.html
```

This will show you:
- Raw API response
- Parsed book data
- Cover images (if available)
- Any errors

### 2. Check Browser Console

1. Open the Book Registration page
2. Press `F12` to open Developer Tools
3. Click on the "Console" tab
4. Try to fetch a book by ISBN
5. Look for these console messages:

```
Fetching from OpenLibrary for ISBN: 9780143038092
OpenLibrary API Response: { ... }
Book data found: { ... }
Cover data: { small: "...", medium: "...", large: "..." }
Publish date: "2006"
Transformed data: { ... }
Cover URLs: { small: "...", medium: "...", large: "..." }
```

### 3. Common Issues & Solutions

#### Issue: "Images not loading"

**Possible Causes:**
1. Book doesn't have cover in OpenLibrary
2. CORS or network issue
3. Invalid image URL

**Solutions:**
- Check console for actual cover URLs
- Try the test HTML file to verify images load
- Some books don't have covers - this is normal
- Use a different ISBN to test (try: 9780143038092)

#### Issue: "Year not prepopulating"

**Possible Causes:**
1. OpenLibrary returns year in unexpected format
2. Year extraction regex not matching
3. Form field not updating

**Solutions:**
- Check console for "Publish date:" log
- Verify transformed data shows publication_year
- Check if the input field has value attribute

**Debug in console:**
```javascript
// In browser console on Book Registration page
// After clicking "Fetch Details", run:
console.log('Form Data:', formData)
```

### 4. Test with Known Good ISBNs

Try these ISBNs that definitely work in OpenLibrary:

| ISBN | Title | Has Cover? |
|------|-------|------------|
| 9780143038092 | The Joy Luck Club | ✅ Yes |
| 9780316769174 | The Catcher in the Rye | ✅ Yes |
| 9780061120084 | To Kill a Mockingbird | ✅ Yes |
| 9780451524935 | 1984 | ✅ Yes |
| 9780060935467 | To Kill a Mockingbird (old) | ❌ No |

### 5. Network Debugging

#### Check if OpenLibrary is accessible:

```bash
# Test API directly with curl
curl "https://openlibrary.org/api/books?bibkeys=ISBN:9780143038092&format=json&jscmd=data"
```

#### Expected Response:
```json
{
  "ISBN:9780143038092": {
    "title": "The Joy Luck Club",
    "authors": [...],
    "cover": {
      "small": "https://covers.openlibrary.org/b/id/14599648-S.jpg",
      "medium": "https://covers.openlibrary.org/b/id/14599648-M.jpg",
      "large": "https://covers.openlibrary.org/b/id/14599648-L.jpg"
    },
    "publish_date": "2006",
    ...
  }
}
```

### 6. Check Browser Network Tab

1. Open Developer Tools (F12)
2. Go to "Network" tab
3. Try fetching a book
4. Look for request to `openlibrary.org`
5. Check:
   - Status code (should be 200)
   - Response preview
   - Response headers

### 7. Verify Database Migration

Make sure the database migration ran successfully:

```sql
-- Connect to database and run:
\d books

-- You should see these new columns:
-- cover_small
-- cover_medium
-- cover_large
-- subjects
-- openlibrary_key
-- openlibrary_url
-- excerpt
-- dewey_decimal
-- lc_classification
```

### 8. Check Frontend Code

Verify these files were updated:
- `/frontend/src/api.js` - Has `fetchBookFromOpenLibrary` function
- `/frontend/src/pages/BookRegistration.jsx` - Has auto-fetch section
- `/backend/app.py` - Updated create_book and update_book

### 9. Manual Test Steps

1. **Navigate to Book Registration**
2. **Enter ISBN**: `9780143038092`
3. **Click "Fetch Details"**
4. **Check Console for logs**
5. **Verify**:
   - Title field populates
   - Author field populates
   - Year field shows 2006
   - Cover image appears on right side

### 10. If Nothing Works

**Emergency Fallback:**

1. Manually enter book details (app works without OpenLibrary)
2. Check if OpenLibrary.org is down:
   ```bash
   curl -I https://openlibrary.org
   ```
3. Review console errors for specifics
4. Check if CORS is blocked (look for CORS error in console)

## Still Having Issues?

### Collect Debug Information:

1. **Browser Console Output** (full logs)
2. **Network Tab** (OpenLibrary request/response)
3. **Database Schema** (verify columns exist)
4. **Test ISBN used**
5. **Any error messages**

### Share in Issue Report:

Create an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Console logs
- Screenshot if helpful

## Quick Fix Checklist

- [ ] Database migration ran successfully
- [ ] Browser cache cleared (Ctrl+Shift+Delete)
- [ ] Application restarted
- [ ] Using valid ISBN-10 or ISBN-13
- [ ] OpenLibrary.org is accessible
- [ ] No CORS errors in console
- [ ] Console shows "Fetching from OpenLibrary..." message
- [ ] Test HTML file works
- [ ] Tried a known-good ISBN (9780143038092)

## Developer Notes

### Enable Verbose Logging:

Already enabled in the code! Check console for detailed logs at each step.

### Disable OpenLibrary (if needed):

If OpenLibrary is causing issues, you can temporarily disable auto-fetch by removing the "Fetch Details" button or commenting out the API call.

### Alternative: Google Books API

If OpenLibrary consistently fails, consider switching to Google Books API (requires API key but has more coverage).
