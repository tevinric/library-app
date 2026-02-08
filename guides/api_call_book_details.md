https://openlibrary.org/api/books?bibkeys=ISBN:9780143038092&format=json&jscmd=data

https://search.brave.com/search?q=I+want+a+free+api+to+call+to+get+book+details+from+barcode&summary=1&conversation=08b6371de4b3878938c794c64d15748e2d52

You can use the Open Library API for free to get book details from a barcode (specifically an ISBN).  It’s simple, requires no setup, and returns key information like title, author, and cover image. 

API Endpoint: https://openlibrary.org/api/books?bibkeys=ISBN:{ISBN}&format=json&jscmd=data
Example Request: https://openlibrary.org/api/books?bibkeys=ISBN:9780143038092&format=json&jscmd=data
Returns: Title, authors (as a comma-separated string), cover image URL, and more. 
For a ready-to-use solution, consider GitHub - imonroe/bookscanner, a PHP library that validates the ISBN and fetches data via Open Library. 

Alternatively, Google Books API is also free and provides rich details (description, categories, ratings), but requires an API key and has usage limits.

✅ Best free option: Open Library API — no key needed, no cost, and ideal for basic book lookup. 



OR 

To retrieve book details from a barcode (like an ISBN) using Python, you can use the Google Books API, which is free and widely used. 

Google Books API
Endpoint: https://www.googleapis.com/books/v1/volumes
Method: GET
Query Parameter: q=isbn:XXXXXXXXXX (replace with your 10- or 13-digit ISBN)
No API key required for basic usage, though a key is recommended for higher limits. 
Example Python Code:
import json
from urllib.request import urlopen

isbn = input("Enter 10 or 13-digit ISBN: ").strip()
api_url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"

try:
    with urlopen(api_url) as response:
        book_data = json.load(response)
    
    if book_data["totalItems"] > 0:
        volume_info = book_data["items"][0]["volumeInfo"]
        print(f"Title: {volume_info.get('title', 'N/A')}")
        print(f"Authors: {', '.join(volume_info.get('authors', ['N/A']))}")
        print(f"Publisher: {volume_info.get('publisher', 'N/A')}")
        print(f"Published Date: {volume_info.get('publishedDate', 'N/A')}")
        print(f"Page Count: {volume_info.get('pageCount', 'N/A')}")
        print(f"Description: {volume_info.get('description', 'N/A')[:200]}...")
    else:
        print("No book found for this ISBN.")
except Exception as e:
    print(f"Error: {e}")

✅ Free and reliable for low-to-moderate usage. 
📌 Note: For production use or high volume, get a free API key at Google Cloud Console. 