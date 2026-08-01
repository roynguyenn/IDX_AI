import pandas as pd
import mysql.connector
from sqlalchemy import create_engine
from dotenv import load_dotenv
import os

#setting up the environment variables
load_dotenv(dotenv_path="../.env")

engine = create_engine(
    f"mysql+mysqlconnector://{os.getenv('MYSQL_USER')}:{os.getenv('MYSQL_PASSWORD')}@{os.getenv('MYSQL_HOST')}/{os.getenv('MYSQL_DATABASE')}"
)


# Function to get city market summary
def get_city_market_summary(limit=25):
    query = """
        SELECT
            City,
            COUNT(*) AS sold_count,
            ROUND(AVG(ClosePrice), 0) AS avg_close_price,
            ROUND(AVG(ClosePrice / NULLIF(LivingArea,0)),0) AS avg_price_per_sqft,
            ROUND(AVG(DaysOnMarket), 1) AS avg_dom,
            ROUND(AVG(ClosePrice / NULLIF(ListPrice,0)) * 100, 1) AS list_to_close_pct
        FROM california_sold
        WHERE PropertyType = 'Residential'
          AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)
          AND LivingArea > 0
        GROUP BY City
        ORDER BY sold_count DESC
        LIMIT %s
    """
    df = pd.read_sql(query, engine, params=(limit,))
    return df

def get_price_trend(city: str, months: int = 24):
    query = """SELECT
            DATE_FORMAT(CloseDate, '%Y-%m') AS month,
            COUNT(*) AS sales,
            ROUND(AVG(ClosePrice), 0) AS avg_price,
            ROUND(AVG(DaysOnMarket), 1) AS avg_dom
        FROM california_sold
        WHERE City = %s
          AND PropertyType = 'Residential'
          AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
        GROUP BY DATE_FORMAT(CloseDate, '%Y-%m')
        ORDER BY month"""
    df = pd.read_sql(query, engine, params=(city, months))
    df["price_change_pct"] = df["avg_price"].pct_change() * 100
    return df


# testing:
if __name__ == "__main__":
    df = get_city_market_summary()
    print(df)

    new_df = get_price_trend("Irvine", 12)
    print(new_df)
    