https://openlibrary.org/api/books?bibkeys=ISBN:9780143038092&format=json&jscmd=data

https://search.brave.com/search?q=I+want+a+free+api+to+call+to+get+book+details+from+barcode&summary=1&conversation=08b6371de4b3878938c794c64d15748e2d52

You can use the Open Library API for free to get book details from a barcode (specifically an ISBN).  It’s simple, requires no setup, and returns key information like title, author, and cover image. 

API Endpoint: https://openlibrary.org/api/books?bibkeys=ISBN:{ISBN}&format=json&jscmd=data
Example Request: https://openlibrary.org/api/books?bibkeys=ISBN:9780143038092&format=json&jscmd=data
Returns: Title, authors (as a comma-separated string), cover image URL, and more. 
For a ready-to-use solution, consider GitHub - imonroe/bookscanner, a PHP library that validates the ISBN and fetches data via Open Library. 

Alternatively, Google Books API is also free and provides rich details (description, categories, ratings), but requires an API key and has usage limits.

✅ Best free option: Open Library API — no key needed, no cost, and ideal for basic book lookup. 


API response structure:

	
ISBN:9780143038092	
url	"https://openlibrary.org/books/OL26690126M/The_Joy_Luck_Club"
key	"/books/OL26690126M"
title	"The Joy Luck Club"
authors	
0	
url	"https://openlibrary.org/authors/OL220796A/Amy_Tan"
name	"Amy Tan"
1	
url	"https://openlibrary.org/authors/OL6590931A/Gwendoline_Yeo"
name	"Gwendoline Yeo"
2	
url	"https://openlibrary.org/authors/OL581042A/Tsai_Chin"
name	"Tsai Chin"
3	
url	"https://openlibrary.org/authors/OL31363A/Ronald_Bass"
name	"Ronald Bass"
4	
url	"https://openlibrary.org/authors/OL6454978A/Wayne_Wang"
name	"Wayne Wang"
5	
url	"https://openlibrary.org/authors/OL3202983A/Jordi_Fibla"
name	"Jordi Fibla"
number_of_pages	288
pagination	"288 pages ;"
by_statement	"Amy Tan"
identifiers	
isbn_10	
0	"0143038095"
isbn_13	
0	"9780143038092"
oclc	
0	"76273134"
openlibrary	
0	"OL26690126M"
classifications	
lc_classifications	
0	"PS3570.A48 J6 2006"
1	""
dewey_decimal_class	
0	"813/.54"
publishers	
0	
name	"Penguin Books"
publish_date	"2006"
subjects	
0	
name	"Chinese American"
url	"https://openlibrary.org/subjects/chinese_american"
1	
name	"Chinese American women"
url	"https://openlibrary.org/subjects/chinese_american_women"
2	
name	"Chinese American women in fiction"
url	"https://openlibrary.org/subjects/chinese_american_women_in_fiction"
3	
name	"Chinese Americans"
url	"https://openlibrary.org/subjects/chinese_americans"
4	
name	"Chinese Americans in fiction"
url	"https://openlibrary.org/subjects/chinese_americans_in_fiction"
5	
name	"Death"
url	"https://openlibrary.org/subjects/death"
6	
name	"Female friendship"
url	"https://openlibrary.org/subjects/female_friendship"
7	
name	"Female friendship in fiction"
url	"https://openlibrary.org/subjects/female_friendship_in_fiction"
8	
name	"Fiction"
url	"https://openlibrary.org/subjects/fiction"
9	
name	"Literature"
url	"https://openlibrary.org/subjects/literature"
10	
name	"Loss (Psychology)"
url	"https://openlibrary.org/subjects/loss_(psychology)"
11	
name	"Mothers"
url	"https://openlibrary.org/subjects/mothers"
12	
name	"Mothers and daughters"
url	"https://openlibrary.org/subjects/mothers_and_daughters"
13	
name	"Mothers and daughters in fiction"
url	"https://openlibrary.org/subjects/mothers_and_daughters_in_fiction"
14	
name	"Mothers in fiction"
url	"https://openlibrary.org/subjects/mothers_in_fiction"
15	
name	"Reminiscing in old age"
url	"https://openlibrary.org/subjects/reminiscing_in_old_age"
16	
name	"Reminiscing in old age in fiction"
url	"https://openlibrary.org/subjects/reminiscing_in_old_age_in_fiction"
17	
name	"Societies and clubs"
url	"https://openlibrary.org/subjects/societies_and_clubs"
18	
name	"Women"
url	"https://openlibrary.org/subjects/women"
19	
name	"Women in fiction"
url	"https://openlibrary.org/subjects/women_in_fiction"
20	
name	"California"
url	"https://openlibrary.org/subjects/california"
21	
name	"San Francisco (Calif.)"
url	"https://openlibrary.org/subjects/san_francisco_(calif.)"
22	
name	"Asian Americans"
url	"https://openlibrary.org/subjects/asian_americans"
23	
name	"Mother and child"
url	"https://openlibrary.org/subjects/mother_and_child"
24	
name	"Littérature américaine"
url	"https://openlibrary.org/subjects/littérature_américaine"
25	
name	"Auteurs d'origine chinoise"
url	"https://openlibrary.org/subjects/auteurs_d'origine_chinoise"
26	
name	"open_syllabus_project"
url	"https://openlibrary.org/subjects/open_syllabus_project"
27	
name	"Reading Level-Grade 11"
url	"https://openlibrary.org/subjects/reading_level-grade_11"
28	
name	"Reading Level-Grade 10"
url	"https://openlibrary.org/subjects/reading_level-grade_10"
29	
name	"Reading Level-Grade 12"
url	"https://openlibrary.org/subjects/reading_level-grade_12"
30	
name	"Fiction, family life"
url	"https://openlibrary.org/subjects/fiction,_family_life"
31	
name	"Friendship, fiction"
url	"https://openlibrary.org/subjects/friendship,_fiction"
32	
name	"San francisco (calif.), fiction"
url	"https://openlibrary.org/subjects/san_francisco_(calif.),_fiction"
33	
name	"Mothers and daughters, fiction"
url	"https://openlibrary.org/subjects/mothers_and_daughters,_fiction"
34	
name	"Chinese americans, fiction"
url	"https://openlibrary.org/subjects/chinese_americans,_fiction"
35	
name	"Fiction, psychological"
url	"https://openlibrary.org/subjects/fiction,_psychological"
36	
name	"Large type books"
url	"https://openlibrary.org/subjects/large_type_books"
37	
name	"Fiction, family life, general"
url	"https://openlibrary.org/subjects/fiction,_family_life,_general"
38	
name	"Fiction, sagas"
url	"https://openlibrary.org/subjects/fiction,_sagas"
39	
name	"Fictional Works [Publication Type]"
url	"https://openlibrary.org/subjects/fictional_works_[publication_type]"
40	
name	"Asian American"
url	"https://openlibrary.org/subjects/asian_american"
41	
name	"Literary"
url	"https://openlibrary.org/subjects/literary"
42	
name	"Sagas"
url	"https://openlibrary.org/subjects/sagas"
43	
name	"Autographed books"
url	"https://openlibrary.org/subjects/autographed_books"
44	
name	"Ficción"
url	"https://openlibrary.org/subjects/ficción"
45	
name	"Novela hogareña"
url	"https://openlibrary.org/subjects/novela_hogareña"
46	
name	"Mujeres chino-americanas"
url	"https://openlibrary.org/subjects/mujeres_chino-americanas"
47	
name	"Madre e hija"
url	"https://openlibrary.org/subjects/madre_e_hija"
48	
name	"Drama"
url	"https://openlibrary.org/subjects/drama"
49	
name	"Chinese American families"
url	"https://openlibrary.org/subjects/chinese_american_families"
50	
name	"Madres e hijas"
url	"https://openlibrary.org/subjects/madres_e_hijas"
51	
name	"Novela"
url	"https://openlibrary.org/subjects/novela"
subject_places	
0	
name	"San Francisco (Calif.)"
url	"https://openlibrary.org/subjects/place:san_francisco_(calif.)"
1	
name	"United States"
url	"https://openlibrary.org/subjects/place:united_states"
subject_times	
0	
name	"20th century"
url	"https://openlibrary.org/subjects/time:20th_century"
excerpts	
0	
text	"My father has asked me to be the fourth corner at the Joy Luck Club."
comment	""
first_sentence	true
table_of_contents	
0	
level	0
label	""
title	"Feathers from a thousand Li away --"
pagenum	""
1	
level	0
label	""
title	"The twenty-six malignant gates --"
pagenum	""
2	
level	0
label	""
title	"American translation --"
pagenum	""
3	
level	0
label	""
title	"Queen mother of the western skies."
pagenum	""
ebooks	
0	
preview_url	"https://archive.org/details/joyluckclub00amyt_0"
availability	"restricted"
formats	{}
cover	
small	"https://covers.openlibrary.org/b/id/14599648-S.jpg"
medium	"https://covers.openlibrary.org/b/id/14599648-M.jpg"
large	"https://covers.openlibrary.org/b/id/14599648-L.jpg"