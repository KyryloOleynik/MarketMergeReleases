from catboost import CatBoostRegressor, Pool
import sys, json, pandas as pd, traceback, re, spacy, Levenshtein
from rapidfuzz import fuzz
from unidecode import unidecode
from sklearn.preprocessing import MultiLabelBinarizer

KNOWN_BRANDS_DICT = {
    '032c': ['032c'],
    'A Ma Maniére': ['a ma maniere'],
    'A-Cold-Wall': ['a-cold-wall', 'a cold wall'],
    'A.P.C.': ['a p c'],
    'AMBUSH': ['ambush'],
    'AMI': ['ami'],
    'ASICS': ['asics'],
    'Acne Studios': ['acne studios'],
    'Adidas': ['adidas'],
    'Alaïa': ['alaia'],
    'Alexander McQueen': ['alexander mcqueen', 'mcqueen'],
    'Allbirds': ['allbirds'],
    'Alpha Industries': ['alpha industries'],
    'Amiri': ['amiri'],
    'Anti Social Social Club': ['anti social social club'],
    'Anya Hindmarch': ['anya hindmarch'],
    "Arc'teryx": ["arc'teryx", 'arcteryx'],
    'Aries': ['aries'],
    'Armani': ['armani', 'giorgio armani'],
    'Audemars Piguet': ['audemars piguet'],
    'BAPE': ['bape', 'a bathing ape'],
    'BOSS': ['boss', 'hugo boss'],
    'Balenciaga': ['balenciaga'],
    'Balmain': ['balmain'],
    'Barbour': ['barbour'],
    'Belstaff': ['belstaff'],
    'Berluti': ['berluti'],
    'Billionaire Boys Club': ['billionaire boys club'],
    'Bottega Veneta': ['bottega veneta', 'bottega'],
    'Brain Dead': ['brain dead'],
    'Brioni': ['brioni'],
    'Brooks': ['brooks'],
    'Brunello Cucinelli': ['brunello cucinelli'],
    'Bulgari': ['bulgari', 'bvlgari'],
    'Burberry': ['burberry'],
    'CAV EMPT': ['cav empt', 'c e'],
    'COS': ['cos'],
    'CP COMPANY': ['cp company'],
    'Cactus Plant Flea Market': ['cactus plant flea market', 'cpfm'],
    'Canada Goose': ['canada goose'],
    'Canali': ['canali'],
    'Carhartt': ['carhartt'],
    'Cartier': ['cartier'],
    'Celine': ['celine', 'celine'],
    'Chanel': ['chanel'],
    'Chloé': ['chloe'],
    'Christian Louboutin': ['christian louboutin'],
    'Clarks': ['clarks'],
    'Coach': ['coach'],
    'Comme des Garçons': ['comme des garcons', 'cdg', 'comme des garcons'],
    'Common Projects': ['common projects'],
    'Converse': ['converse'],
    'Crocs': ['crocs'],
    'Denim Tears': ['denim tears'],
    'Dior': ['dior'],
    'Dolce & Gabbana': ['dolce gabbana', 'd g'],
    'Dr. Martens': ['dr martens'],
    'Dries Van Noten': ['dries van noten'],
    'Dsquared2': ['dsquared2'],
    'Enrico Mandelli': ['enrico mandelli'],
    'Ermenegildo Zegna': ['ermenegildo zegna', 'zegna'],
    'Etro': ['etro'],
    'Fear of God': ['fear of god', 'essentials', 'fear of god essentials'],
    'Fendi': ['fendi'],
    'Fila': ['fila'],
    'Ganni': ['ganni'],
    'Gentle Monster': ['gentle monster'],
    'Givenchy': ['givenchy'],
    'Golden Goose': ['golden goose'],
    'Golf Wang': ['golf wang'],
    'Gucci': ['gucci'],
    'H&M': ['h m'],
    'HUMAN MADE': ['human made'],
    'Helmut Lang': ['helmut lang'],
    'Hermès': ['hermes', 'hermes', 'hermes'],
    'Heron Preston': ['heron preston'],
    'Hoka One One': ['hoka one one'],
    'Hublot': ['hublot'],
    'Icecream': ['icecream'],
    'Isabel Marant': ['isabel marant'],
    'Issey Miyake': ['issey miyake'],
    'Jacquemus': ['jacquemus'],
    'Jil Sander': ['jil sander'],
    'Jimmy Choo': ['jimmy choo'],
    'John Elliott': ['john elliott'],
    'Jordan': ['jordan', 'air jordan'],
    'Kanye West': ['kanye west', 'kanye', 'ye'],
    'Kappa': ['kappa'],
    'Kenzo': ['kenzo'],
    'KidSuper': ['kidsuper'],
    'Kith': ['kith'],
    'Ksubi': ['ksubi'],
    'Lacoste': ['lacoste'],
    'Lanvin': ['lanvin'],
    'Lemaire': ['lemaire'],
    'Loewe': ['loewe'],
    'Loro Piana': ['loro piana'],
    'Louis Vuitton': ['louis vuitton', 'lv'],
    'Lululemon': ['lululemon'],
    'Maison Kitsuné': ['maison kitsune'],
    'Maison Margiela': ['maison margiela', 'margiela', 'mm6 maison margiela', 'mm6'],
    'Maje': ['maje'],
    'Manolo Blahnik': ['manolo blahnik'],
    'Marc Jacobs': ['marc jacobs'],
    'Margaux': ['margaux'],
    'Massimo Dutti': ['massimo dutti'],
    'Michael Kors': ['michael kors'],
    'Missoni': ['missoni'],
    'Miu Miu': ['miu miu'],
    'Moncler': ['moncler', 'moncler genius'],
    'Moschino': ['moschino'],
    'Mulberry': ['mulberry'],
    'Napapijri': ['napapijri'],
    'Neighborhood': ['neighborhood'],
    'New Balance': ['new balance'],
    'Nike': ['nike'],
    'Noah': ['noah'],
    'Off-White': ['off-white', 'off white', 'off-whitetm'],
    'Officine Générale': ['officine generale'],
    'PUMA': ['puma'],
    'Palace': ['palace'],
    'Palm Angels': ['palm angels'],
    'Paloma Barceló': ['paloma barcelo'],
    'Patagonia': ['patagonia'],
    'Patek Philippe': ['patek philippe'],
    'Patta': ['patta'],
    'Paul Smith': ['paul smith'],
    'Philipp Plein': ['philipp plein'],
    'Prada': ['prada', 'prada linea rossa'],
    'Premiata': ['premiata'],
    'Proenza Schouler': ['proenza schouler'],
    'Raf Simons': ['raf simons', 'raf', 'rafsimons'],
    'Ralph Lauren': ['ralph lauren', 'polo ralph lauren'],
    'Reebok': ['reebok'],
    'Represent': ['represent'],
    'Rick Owens': ['rick owens', 'rick owens drkshdw'],
    'Rimowa': ['rimowa'],
    'Roger Vivier': ['roger vivier'],
    'Rolex': ['rolex'],
    'Sacai': ['sacai'],
    'Saint Laurent': ['saint laurent', 'yves saint laurent', 'ysl', 'saint laurent paris'],
    'Salomon': ['salomon'],
    'Salvatore Ferragamo': ['salvatore ferragamo'],
    'Sandro': ['sandro'],
    'Saucony': ['saucony'],
    'Sergio Rossi': ['sergio rossi'],
    'Skechers': ['skechers'],
    'Stone Island': ['stone island', 'stone island shadow project'],
    'Stussy': ['stussy', 'stussy'],
    'Supra': ['supra'],
    'Supreme': ['supreme'],
    'TAG Heuer': ['tag heuer'],
    'The North Face': ['the north face', 'tnf'],
    'The Row': ['the row'],
    'Thom Browne': ['thom browne'],
    'Tiffany': ['tiffany', 'tiffany co'],
    'Timberland': ['timberland'],
    "Tod's": ["tod's"],
    'Tom Ford': ['tom ford', 'tom ford eyewear'],
    'Tommy Hilfiger': ['tommy hilfiger'],
    'Trapstar': ['trapstar'],
    'Travis Scott': ['travis scott'],
    'UGG': ['ugg'],
    'Undercover': ['undercover'],
    'Valentino': ['valentino'],
    'Valextra': ['valextra'],
    'Vans': ['vans'],
    'Veja': ['veja'],
    'Versace': ['versace'],
    'Vetements': ['vetements'],
    'WTAPS': ['wtaps'],
    'Y-3': ['y-3'],
    'Yeezy': ['yeezy'],
    'Yohji Yamamoto': ['yohji yamamoto'],
    'ZARA': ['zara'],
    'Zimmermann': ['zimmermann'],
    'entire studios': ['entire studios']
}

TYPES = {
    "sneakers": [
        "sneakers","snikers","sneaker","sneekers","running shoes","basketball shoes",
        "tennis shoes","trail running shoes","sports shoes","trainers","tenisky",
        "athletic shoes","gym shoes","running sneakers","sports trainers",
        "high-top sneakers","low-top sneakers","cleats","football boots","soccer shoes",
        "futsal shoes","indoor soccer shoes","agility shoes","turf shoes",
        "бутсы","футзалки","бутси","кроссовки","кросовки","кеды",
        "футбольні бутси","спортивні бутси","спортивне взуття","кросівки для бігу",
        "баскетбольні кросівки","тенісні кросівки","снікерcи","slip-on sneakers"
    ],

    "boots": [
        "boots","boot","ankle boots","chelsea boots","cowboy boots","hiking boots",
        "rain boots","snow boots","dress boots","combat boots","work boots","military boots",
        "ботинки","ботінки","черевики","чоботи","ботфорти","ботфорти жіночі","сапоги",
        "високі черевики","сапоги до коліна","ботинки на шнуровке","сапоги зимние",
        "високі чоботи","чоботи жіночі","берці","combat boots"
    ],

    "slippers": [
        "slippers","house slippers","fuzzy slippers","тапочки","капці","шльопанці",
        "домашні тапочки","домашние тапки","м’які тапочки","slip-ons","сліпони"
    ],

    "loafers": [
        "loafer","loafers","driving shoes","penny loafers","tassel loafers","dress loafers",
        "лоферы","лофери","туфли-лоферы","лофери чоловічі","лофери жіночі",
        "мокасины","макасіни","moccasins",
        "oxford shoes","derby shoes","monk strap shoes","cap-toe oxford","wingtip oxford",
        "оксфорды","оксфорди","дерби","дербі","монки","туфлі","туфли","dress shoes",
        "mules","backless mules","heelless mules","clogs","клоги","кломпы","мюли","мюлі"
    ],

    "sandals": [
        "sandals","flip-flops","hiking sandals","slide sandals","sport sandals","toe-ring sandals",
        "сандалии","сандалі","вьетнамки","в'єтнамки","літні сандалі","спортивні сандалі","сандалии на плоской подошве",
        "кроксы","crocs",
        "espadrilles","canvas espadrilles","rope-soled espadrilles","эспадрильи","еспадрилли","еспадрильї"
    ],

    "pants": [
        "pants","trousers","брюки","штаны","штани","cargo pants","chinos",
        "dress pants","palazzo pants","leggings","yoga pants","джогери","joggers",
        "бриджи","бріджі"
    ],

    "sweater": [
        "sweater","свитер","светр","pullover","crewneck","v-neck","jumper",
        "джемпер","cardigan","hoodie","худі","худи","толстовка","turtleneck",
        "гольф","батник","батнік","кофта","sweatshirt","лонгслив","longsleeve","свитшот"
    ],

    "jacket": [
        "jacket","куртка","куртку","куртки","курточка","bomber jacket","denim jacket",
        "leather jacket","windbreaker","parka","anorak","анорак","puffer jacket",
        "shell jacket","softshell jacket","fleece jacket","goretex jacket","шкірянка",
        "овершот","overshirt","куртка-вітровка","куртка-ветровка","вітровка",
        "зіпка","зипка","zip","zip jacket","zipper jacket",
        "track jacket","tracksuit top","олимпийка","олімпійка",
        "бомбер","бомберка","бомпер","bomber","windbreaker jacket",
        "мікропуховик","микропуховик","light puffer jacket","фліска","fleece jacket"
    ],

    "coat": [
        "coat","пальто","overcoat","trench coat","тренч плащ","pea coat","duffle coat",
        "shearling coat","fur coat","wrap coat","cocoon coat","пальтишко","пуховик",
        "down jacket","down coat","камзол","сюртук","stompunk coat","дублянка","sheepskin coat",
        "шуба","fur coat","шуба"
    ],

    "swimwear": [
        "swimsuit","купальник","one-piece swimsuit","tankini","cover-up","beach shorts",
        "bikini","плавки","swim trunks"
    ],

    "sleepwear": [
        "pajamas","пижама","піжама"
    ],

    "shirt": [
        "shirt","рубашка","сорочка","henley shirt","сорочечка","сорочка чоловіча",
        "регбійка","регбийка","rugby shirt","шведка","шведка сорочка",
        "гавайка","hawaiian shirt"
    ],

    "blazer": [
        "blazer", "пиджак", "жакет", "піджак",
        "suit", "костюм", "смокинг", "smoking", "tuxedo", "dinner jacket",
        "вечерний костюм", "вечірній костюм", "офисный костюм", "офісний костюм",
        "деловой костюм", "бізнес-костюм"
    ],

    "t_shirt": [
        "t-shirt","tee","футболка","футболочка","т-шот","топ","топік",
        "tank top","майка","футболка без рукавов","tube top","bandeau","топ","безорукавка","футболка без рукавів","безрукавка"
    ],

    "polo": [
        "polo shirt","поло","футболка-поло","теніска","тениска","тениска-поло"
    ],

    "blouse": [
        "blouse", "блузка", "sheer blouse", "блузочка", "блузон", "блуза",
        "вишиванка", "вышиванка", "embroidered shirt", "ukrainian blouse"
    ],

    "hat": [
        "hat","шляпа","шапка","beanie","cap","visor","bucket hat","beret","панама","капелюх","біні"
    ],

    "bag": [
        "bag","сумка","backpack","рюкзак","tote bag","shoulder bag","crossbody bag","duffle bag",
        "suitcase","luggage","belt bag","waist bag","fanny pack","clutch","purse","wallet"
    ],

    "socks": [
        "socks","носки","шкарпетки","leg warmers","spats"
    ],

    "jewelry": [
        "ring","кольцо","перстень","earrings","серьги","necklace","ожерелье","pendant","браслет","anklet","чарм"
    ],

    "watch": [
        "watch","часы","годинник","watch band"
    ],

    "lingerie": [
        "lingerie","бельё","camisole","chemise","bodice","corset","slip","nightgown","robe","garter belt",
        "bodysuit","body","боді","боди"
    ],

    "belt": [
        "belt","ремень","ремінь"
    ],

    "tie": [
        "tie","галстук","краватка","bow tie","бабочка","метелик"
    ],

    "skirt": [
        "skirt","юбка","спідниця","maxi skirt","mini skirt","pleated skirt","pencil skirt","skort","culotte skirt"
    ],

    "jeans": [
        "jeans","джинсы","джинси","skinny jeans","straight jeans","flare jeans","mom jeans","boyfriend jeans","bootcut jeans","jeggings"
    ],

    "shorts": [
        "shorts","шорты","шорти","cycling shorts","cargo shorts","bermuda shorts","bike shorts"
    ],

    "dress": [
        "dress","платье","сукня","maxi dress","midi dress","mini dress","sundress","wrap dress","sheath dress","cocktail dress","evening gown","ball gown","prom dress"
    ],

    "uniform": [
        "uniform","униформа","scrubs","lab coat","work overalls","hi-vis jacket"
    ]
}

model = None
nlp = None
is_initialized = False

def normalize_text(text: str) -> str:
    if not isinstance(text, str):
        return "-"
    text = unidecode(text).lower()
    text = re.sub(r"[^a-z0-9\s'-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def detect_brand(title: str):
    norm_title = normalize_text(title)
    if not norm_title:
        return []

    words = norm_title.split()
    found = []
    for key, brand_list in KNOWN_BRANDS_DICT.items():
        for brand in brand_list:
            brand_len = len(brand.split())
            for i in range(len(words) - brand_len + 1):
                phrase = " ".join(words[i:i+brand_len])
                if Levenshtein.distance(phrase, brand) <= 1 and key not in found:
                    found.append(key)
    return found

def get_model(title):
    if not nlp:  
        return '-'
    doc = nlp(title)
    model_entities = [ent.text.strip() for ent in doc.ents 
                        if ent.label_ == 'MODEL' and len(ent.text) > 1]
    if len(model_entities) > 0:
        return ' '.join(model_entities)
    return '-'

def get_type(title):
    threshold = 85
    for typ, features in TYPES.items():
        if any(fuzz.partial_ratio(feature.lower(), title.lower()) >= threshold for feature in features):
            return typ
    return

def collaboration(title: str, price: float) -> float:
    if price < 79.0:
        return 0.0
    if not title or not isinstance(title, str):
        return 0.0
    title = title.strip()
    
    COLLAP_PATTERNS = [
        r"\bcollab\b", r"\bколлаб\b", r"\bколаб\b", r"\bколаборация\b", r"\bcollaboration\b",
        r"\bft\b", r"\bfeat\b", r"\bcapsule\b", r"\bexclusive\b",
        r"\bspecial edition\b", r"\blimited edition\b", r"\blimited edition\b"
    ]

    pattern = re.compile(r"\b([a-z0-9'-]+)\s*[x×]\s*([a-z0-9'-]+)\b", re.IGNORECASE)
    match = pattern.search(title)

    if match:
        brand1_list = detect_brand(match.group(1))
        brand2_list = detect_brand(match.group(2))
        if brand1_list and brand2_list and len(brand1_list) > 0 and len(brand2_list) > 0:
            brand1, brand2 = brand1_list[0], brand2_list[0]
            if brand1 != brand2 and brand1 != "No Brand" and brand2 != "No Brand":
                return 1.0

    for pat in COLLAP_PATTERNS:
        if re.search(pat, title, re.IGNORECASE):
            return 1.0

    return 0.0

def load_models(data):
    global model, nlp, is_initialized

    
    path_CatBoost = data.get('catBoostPath', None)
    path_fasionModel = data.get('nerPath', None)
    
    try:
        model = CatBoostRegressor()
        model.load_model(path_CatBoost)
    except Exception as e:
        return False, f'CatBoost load failed: {e}'
    
    try:
        nlp = spacy.load(path_fasionModel)
    except Exception as e:
        return False, f'spaCy load failed: {e}'
    
    is_initialized = True
    return True, "Models loaded successfully"

def process_batch(batch, request_id):
    global model, nlp, is_initialized
    if not is_initialized or not model or not nlp:
        return False, "Models not initialized. Run init first."
    
    if not isinstance(batch, list) or len(batch) == 0:
        return False, 'Invalid batch: expected list'
    
    try:
        target_columns = ['price', 'title', 'condition', 'type', 'model', 'brand', 'is_special', 'size']
        filtered_batch = [{k: d.get(k, None) for k in target_columns} for d in batch]     
        df = pd.DataFrame(filtered_batch, columns=target_columns)

        unique_sizes = {'XXL', 'XL', 'L', 'M', 'S', 'XS', 'XXS', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5', '41', '41.5', '42', '42.5', '43', '43.5', '44', '44.5', '45', '45.5', '46', '46.5', '47', '47.5', '48', '48.5', '49', 'One size', 'Інший' }

        def parse_condition(x):
            try:
                x = str(x)
            except Exception:
                return 'used'
            if pd.isna(x):
                return 'used'
            if 'нов' in x.lower() or 'ne' in x.lower():  
                return 'new'
            return 'used'

        def parse_model(x):
            if pd.isna(x) or not isinstance(x, str):
                return '-'
            try:
                return get_model(x)
            except Exception:
                return '-'

        def parse_type(x):
            if pd.isna(x) or not isinstance(x, str):
                return
            try:
                return get_type(x)
            except Exception:
                return

        def parse_brand(x):
            if pd.isna(x) or not isinstance(x, str):
                return ['No Brand', 'No Brand']
            try:
                brands = detect_brand(x)
                if len(brands) == 0:
                    return ['No Brand', 'No Brand']
                if len(brands) == 1:
                    return [brands[0], 'No Brand']
                return brands[:2]
            except Exception:
                return ['No Brand', 'No Brand']

        def safe_is_special(row):
            try:
                if isinstance(row['title'], str):
                    return collaboration(row['title'], row['price'])
                return 0.0
            except Exception:
                return 0.0 
            
        def normalize_size(sizes_row):
            if pd.isna(sizes_row):
                return 'One size'
            sizes = [size.strip() for size in str(sizes_row).split(',') if size.strip()]
            normalized_sizes = []
            
            numeric_conversions = {
                'US': {0: 30, 2: 32, 4: 34, 6: 36, 8: 38, 10: 40, 12: 42, 14: 44, 16: 46, 18: 48},
                'UK': {2: 30, 4: 32, 6: 34, 8: 36, 10: 38, 12: 40, 14: 42, 16: 44, 18: 46, 20: 48},
                'JP': {3: 30, 5: 32, 7: 34, 9: 36, 11: 38, 13: 40, 15: 42, 17: 44, 19: 46},
                'IT': {36: 34, 38: 36, 40: 38, 42: 40, 44: 42, 46: 44, 48: 46, 50: 48},
                'FR': {32: 34, 34: 36, 36: 38, 38: 40, 40: 42, 42: 44, 44: 46},
                'DE': {30: 32, 32: 34, 34: 36, 36: 38, 38: 40, 40: 42, 42: 44, 44: 46},
                'EU': {}, 
                'INT': {} 
            }
            
            metrics = ['US', 'UK', 'JP', 'IT', 'FR', 'DE', 'EU', 'INT']
            
            for size in sizes:
                try:
                    size_str = str(size).strip().upper()
                    
                    match = re.search(r'([A-Z]{2,3})?\s*(\d+(?:\.\d+)?)\s*([A-Z]{2,3})?', size_str)
                    if match:
                        system1 = match.group(1)
                        num_str = match.group(2)
                        system2 = match.group(3)
                        system = system1 or system2
                        if system in metrics and num_str:
                            try:
                                orig_num = float(num_str)
                                if system in numeric_conversions and int(orig_num) in numeric_conversions[system]:
                                    eu_num = numeric_conversions[system][int(orig_num)]
                                else:
                                    offsets = {'US': 28, 'UK': 26, 'JP': 25, 'EU': 0, 'INT': 0, 'IT': 2, 'FR': 2, 'DE': 2}
                                    offset = offsets.get(system, 0)
                                    eu_num = round(orig_num + offset)
                                    if eu_num > 49 and eu_num < 55:
                                        eu_num = 49
                                    elif eu_num < 36 and eu_num > 29:
                                        eu_num = 36
                                size = str(int(eu_num)) 
                            except ValueError:
                                pass  
                        else:
                            try:
                                orig_num = float(num_str)
                                eu_num = max(36, min(49, round(orig_num)))
                                size = str(int(eu_num))
                            except ValueError:
                                pass
                    
                    if 'eu_num' not in locals() or not num_str: 
                        if re.match(r'^[A-Z]+$', size_str):
                            size = size_str
                        elif size_str in ['ONE SIZE', 'ОДИН РАЗМЕР', 'UNISIZE']:
                            size = 'One size'
                        elif size_str in ['ІНШИЙ', 'OTHER', 'ДРУГОЙ']: 
                            size = 'Інший'
                        else:
                            try:
                                size_num = float(size_str)
                                size_num = max(36, min(49, size_num))
                                if size_num % 1 == 0.5:
                                    half_str = f"{int(size_num)}.5"
                                    size = half_str if half_str in unique_sizes else str(int(size_num))
                                else:
                                    size = str(int(size_num))
                            except ValueError:
                                continue  
                    
                    size_check = size.upper() if re.match(r'^[A-Z]+$', str(size)) else str(size)
                    if size_check in unique_sizes:
                        if str(size) in unique_sizes:
                            normalized_sizes.append(size)
                        
                except Exception:
                    continue
            
            return normalized_sizes
    
        df['size'] = df['size'].apply(normalize_size)            

        encoder = MultiLabelBinarizer(classes=sorted(unique_sizes))
        encoded = encoder.fit_transform(df['size'])

        encoded_df = pd.DataFrame(encoded, columns=[f'has_{size}' for size in sorted(unique_sizes)], index=df.index)

        df = pd.concat([df.drop(['size'], axis=1), encoded_df], axis=1)

        df['type'] = df['title'].transform(parse_type)
        df = df.dropna(subset=['type'])
        target_ids = list(df.index.tolist())
        df['condition'] = df['condition'].transform(parse_condition)
        df['model'] = df['title'].transform(parse_model)
        brands_series = df['title'].apply(parse_brand)
        brand_df = pd.DataFrame(brands_series.tolist(), columns=['brand', 'brand2'], index=df.index)
        brand_df = brand_df.fillna('No Brand')
        df[['brand', 'brand2']] = brand_df
        df['is_special'] = df.apply(safe_is_special, axis=1)

        cat_columns = ['condition', 'type', 'model', 'brand', 'brand2'] 
        df[cat_columns] = df[cat_columns].fillna('-') 
        df[cat_columns] = df[cat_columns].astype(str)  
        for col in cat_columns:
            df[col] = df[col].replace('nan', '-')

        numeric_cols = ['is_special']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                if df[col].isnull().sum() > 0:
                    df[col] = df[col].fillna(0)  
            else:
                print(f"Добавляем отсутствующую 'is_special' как 0")
                df['is_special'] = 0.0

        df = df.drop(columns=['title', 'price'])

        expected_features = model.feature_names_
        if expected_features is not None:
            df = df.reindex(columns=expected_features, fill_value=0) 

        cat_indices = [df.columns.get_loc(col) for col in cat_columns if col in df.columns]

        test_pool = Pool(df, cat_features=cat_indices)
        predictions = model.predict(test_pool)
        
        for pred, id in zip(predictions, target_ids):
            batch[id]['recommendedPrice'] = f'{round(float(pred), 2)}$'
        
        return True, batch
    except Exception as e:
        return False, f"Batch processing failed: {e} | data = {df.to_string()} | batch = {batch} | filtered = {filtered_batch} | traceback: {traceback.format_exc()}"

if __name__ == '__main__':
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break  
            
            line = line.strip()
            if not line:
                continue
            
            try:
                data = json.loads(line)
            except Exception as e:
                print(json.dumps({'error': f'Invalid JSON: {e}'}), file=sys.stderr)
                continue

            request_id = data.get('requestId', None)
            msg_type = data.get('type', 'unknown')
            
            if msg_type == 'init':
                success, msg = load_models(data)
                if success:
                    print(json.dumps({ 'type': 'init_success', 'requestId': request_id }))
                else:
                    print(json.dumps({ 'type': 'init_error', 'error': msg, 'requestId': request_id }), file=sys.stderr)
            
            elif msg_type == 'batch':
                success, result = process_batch(data.get('batch', []), request_id)
                if success:
                    print(json.dumps({ 'type': 'batch_result', 'requestId': request_id, 'result': result }, ensure_ascii=False))
                else:
                    print(json.dumps({ 'type': 'batch_error', 'error': result, 'requestId': request_id }), file=sys.stderr)
            
            else:
                print(json.dumps({ 'type': 'error', 'message': f'Unknown type: {msg_type}', 'requestId': request_id }), file=sys.stderr)
            
            sys.stdout.flush()
            
        except Exception as e:
            error_msg = {'error': f"Main loop error: {e}", 'traceback': traceback.format_exc()}
            print(json.dumps(error_msg, ensure_ascii=False), file=sys.stderr)
            sys.stdout.flush()