# Populate tables w/ seed data 
from csv import DictReader
from pathlib import Path
from jobsentinel.db.engine import get_engine
from jobsentinel.db.companies import upsert_company, list_companies


def main(): 
    engine = get_engine()
    # read the CSV
    # get abs path of script directory 
    script_dir = Path(__file__).parent
    with open(f'{script_dir}/seed_companies.csv', mode='r', encoding='utf-8') as file:
        # create dict reader obj
        reader = DictReader(file)
        for row in reader:
            print(f" Adding: {row['name']},{row['source']},{row['board_token']},")
            # insert into the table 
            upsert_company(
                engine=engine, 
                name=row['name'],
                source=row['source'],
                board_token=row['board_token']
                )

if __name__ == "__main__": 
    main()