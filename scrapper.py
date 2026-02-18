import os
import requests
import re


def get_best_image_url(query, min_size=200):
    search_url = "https://commons.wikimedia.org/w/api.php"

    # Předstíráme, že jsme běžný prohlížeč Chrome na Windows
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    search_params = {
        "action": "query",
        "format": "json",
        "list": "search",
        "srsearch": query,
        "srnamespace": 6,
        "srlimit": 1,
    }

    try:
        response = requests.get(search_url, params=search_params, headers=headers)
        r = response.json()

        search_results = r.get("query", {}).get("search", [])
        if not search_results:
            return None

        filename = search_results[0]["title"]

        info_params = {
            "action": "query",
            "format": "json",
            "prop": "imageinfo",
            "titles": filename,
            "iiprop": "url|size",
        }

        r_info = requests.get(search_url, params=info_params, headers=headers).json()
        pages = r_info.get("query", {}).get("pages", {})
        page_id = list(pages.keys())[0]
        image_info = pages[page_id].get("imageinfo", [{}])[0]

        return image_info.get("url") if image_info.get("width", 0) >= min_size else None
    except Exception as e:
        print(f"    Chyba v API: {e}")
        return None


def download_image(url, folder, filename):
    if not os.path.exists(folder):
        os.makedirs(folder)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    path = os.path.join(folder, filename)
    try:
        # Používáme timeout, aby se skript nezasekl, a headers pro obejití 403
        r = requests.get(url, stream=True, headers=headers, timeout=10)
        if r.status_code == 200:
            with open(path, "wb") as f:
                for chunk in r.iter_content(1024):
                    f.write(chunk)
            return True
        else:
            print(
                f"    Server zamítl přístup (Status {r.status_code}) k URL: {url[:50]}..."
            )
            return False
    except Exception as e:
        print(f"    Chyba při stahování: {e}")
    return False


def main():
    # VSTUPNÍ FORMÁT: textbook1(Dilo1,Dilo2),textbook2(Dilo3)
    user_input = input(
        "Zadejte dotaz (např. textbook1(Creation of Adam Michelangelo,Fountaine Duchamp),textbook2(Mona Lisa Vinci)): "
    )

    # Rozparsování vstupu pomocí regulárních výrazů
    textbooks = re.findall(r"(\w+)\((.*?)\)", user_input)

    for tb_name, items in textbooks:
        query_list = [i.strip() for i in items.split(",")]

        for art_query in query_list:
            print(f"Hledám: {art_query} pro {tb_name}...")

            img_url = get_best_image_url(art_query)

            if img_url:
                clean_name = "".join(
                    [c for c in art_query if c.isalnum() or c in (" ", "_")]
                ).rstrip()
                file_name = f"{tb_name}_{clean_name}.jpg"

                if download_image(img_url, "stazene_obrazy", file_name):
                    print(f"  -> Uloženo jako {file_name}")
                else:
                    print(f"  !! Selhalo stahování {art_query}")
            else:
                print(f"  !! Nenalezen vhodný obrázek (min. 200px) pro: {art_query}")


if __name__ == "__main__":
    main()
