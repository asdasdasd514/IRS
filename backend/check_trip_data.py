import asyncio
from app.core.database import connect_to_mongo, get_database

async def check():
    await connect_to_mongo()
    db = get_database()
    trip = await db.admission_trips.find_one({"trip_code": "TRIP-DEA867-01"})
    if not trip:
        trip = await db.admission_trips.find_one()
    
    print("TRIP ID:", trip.get("id"), "NAME:", trip.get("name"))
    print("START POINT:", trip.get("start_point"))
    print("DESTINATIONS:")
    for i, d in enumerate(trip.get("destinations", [])):
        print(f" - Dest {i+1}: {d.get('name')} | order: {d.get('order')} | preferred_time: {d.get('preferred_visit_time')} | lat: {d.get('lat')} | lng: {d.get('lng')}")
    
    print("WAYPOINTS IN DB:")
    wps = await db.campaign_waypoints.find({"trip_id": trip.get("id")}).sort("visit_order", 1).to_list(10)
    for wp in wps:
        print(f" - WP: {wp.get('name')} | visit_order: {wp.get('visit_order')} | preferred_time: {wp.get('preferred_visit_time')} | is_visited: {wp.get('is_visited')}")

    # Check Campaign as well
    if trip.get("campaign_id"):
        camp = await db.campaigns.find_one({"$or": [{"id": trip["campaign_id"]}, {"_id": trip["campaign_id"]}]})
        if camp:
            print("CAMPAIGN START POINT:", camp.get("start_point"))
            print("CAMPAIGN DESTS:")
            for i, d in enumerate(camp.get("destinations", [])):
                print(f" - Camp Dest {i+1}: {d.get('name')} | order: {d.get('order')} | preferred_time: {d.get('preferred_visit_time')}")

if __name__ == "__main__":
    asyncio.run(check())
