#!/bin/bash

echo "Downloading GeoLite Databases..."
wget "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN&license_key=oA8rjNuhRmxNNhAK&suffix=tar.gz" -O asn.tar.gz
wget "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=oA8rjNuhRmxNNhAK&suffix=tar.gz" -O country.tar.gz

echo "Extracting..."
tar -zxvf asn.tar.gz
tar -zxvf country.tar.gz

mv GeoLite2-ASN_* GeoLite2-ASN
mv GeoLite2-Country_* GeoLite2-Country

echo "Copying..."
cp GeoLite2-ASN/GeoLite2-ASN.mmdb ./databases/GeoLite2-ASN.mmdb
cp GeoLite2-Country/GeoLite2-Country.mmdb ./databases/GeoLite2-Country.mmdb

echo "House cleaning..."
rm -rf GeoLite2-ASN
rm -rf GeoLite2-Country
rm -rf asn.tar.gz
rm -rf country.tar.gz

echo "DONE"