"""Fetch jobs from all companies in Company DB and load into database"""

# Populate tables w/ seed data 
from csv import DictReader
from pathlib import Path
from jobsentinel.db.engine import get_engine
from jobsentinel.db.companies import upsert_company, list_companies


def main(): 
    engine = get_engine()
    # fetch comapnies from db
    # ittr over them and map to specific job board api    
    companies = list_companies(engine=engine)
    print(companies)
if __name__ == "__main__": 
    main()
