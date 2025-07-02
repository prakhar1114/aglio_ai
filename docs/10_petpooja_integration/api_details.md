# Petpooja API Details

## 1. Fetch Menu

### Request

headers
```
Content-Type: application/json
app-key: xxxxxxxxxxxxxxxxxxxxxx
app-secret: xxxxxxxxxxxxxxxxxxxxx
access-token: xxxxxxxxxxxxxxxxxxxxx
```
body
```
{
    "restID" : "xxxxxx"
}
```

### Response
```json
{
    "success": "1",
    "restaurants": [
        {
          "restaurantid": "xxxxx",
          "active": "1",
          "details": {
            "menusharingcode": "xxxxxx",
            "currency_html": "₹",
            "country": "India",
            "images": [

            ],
            "restaurantname": "Heaven",
            "address": "nearsargasan,sghighway,Gandhinagar",
            "contact": "9998696995",
            "latitude": "23.190394",
            "longitude": "72.610591",
            "landmark": "",
            "city3": "Ahmedabad",
            "state": "Gujarat",
            "minimumorderamount": "0",
            "minimumdeliverytime": "60Minutes",
            "minimum_prep_time": "30",
            "deliverycharge": "50",
            "deliveryhoursfrom1": "",
            "deliveryhoursto1": "",
            "deliveryhoursfrom2": "",
            "deliveryhoursto2": "",
            "sc_applicable_on": "H,P,D",
            "sc_type": "2",
            "sc_calculate_on": "2",
            "sc_value": "5",
            "tax_on_sc": "1",
            "calculatetaxonpacking": 1,
            "pc_taxes_id": "11213,20375",
            "calculatetaxondelivery": 1,
            "dc_taxes_id": "11213,20375",
            "packaging_applicable_on": "ORDER",
            "packaging_charge": "20",
            "packaging_charge_type": ""
          }
        }
    ],
    "ordertypes": [
        {
          "ordertypeid": 1,
          "ordertype": "Delivery"
        },
        {
          "ordertypeid": 2,
          "ordertype": "PickUp"
        },
        {
          "ordertypeid": 3,
          "ordertype": "DineIn"
        }
    ],
    "categories": [
        {
          "categoryid": "500773",
          "active": "1",
          "categoryrank": "16",
          "parent_category_id": "0",
          "categoryname": "Pizzaandsides",
          "categorytimings": "",
          "category_image_url": ""
        },
        {
          "categoryid": "500774",
          "active": "1",
          "categoryrank": "17",
          "parent_category_id": "0",
          "categoryname": "Cakes",
          "categorytimings": "",
          "category_image_url": ""
        }
    ],
    "parentcategories": [

    ],
    "items": [
        {
          "itemid": "118829149",
          "itemallowvariation": "0",
          "itemrank": "52",
          "item_categoryid": "500773",
          "item_ordertype": "1,2,3",
          "item_tags": [
                            "vegan",
                            "new",
                            "chef-special"
        ],
          "item_packingcharges": "",
          "itemallowaddon": "1",
          "itemaddonbasedon": "0",
          "item_favorite": "0",
          "ignore_taxes": "0",
          "ignore_discounts": "0",
          "in_stock": "2",
          "variation_groupname": "",
          "variation": [

          ],
          "addon": [
            {
              "addon_group_id": "135699",
              "addon_item_selection_min": "0",
              "addon_item_selection_max": "1"
            },
            {
              "addon_group_id": "135707",
              "addon_item_selection_min": "0",
              "addon_item_selection_max": "4"
            }
          ],
          "itemname": "Veg Loaded Pizza",
          "item_attributeid": "1",
          "itemdescription": "",
          "minimumpreparationtime": "",
          "price": "100",
          "active": "1",
          "item_image_url": "",
          "item_tax": "11213,20375",
          "nutrition": {
            "foodAmount": {
              "amount": 1,
              "unit": "g"
            },
            "calories": {
              "amount": 1,
              "unit": "kcal"
            },
            "protien": {
              "amount": 1,
              "unit": "g"
            },
            "minerals": [
              {
                "name": "Sample",
                "amount": 1,
                "unit": "g"
              }
            ],
            "sodium": {
              "amount": 1,
              "unit": "mg"
            },
            "carbohydrate": {
              "amount": 1,
              "unit": "g"
            },
            "totalSugar": {
              "amount": 1,
              "unit": "g"
            },
            "addedSugar": {
              "amount": 1,
              "unit": "g"
            },
            "totalFat": {
              "amount": 1,
              "unit": "g"
            },
            "saturatedFat": {
              "amount": 1,
              "unit": "g"
            },
            "transFat": {
              "amount": 1,
              "unit": "g"
            },
            "cholesterol": {
              "amount": 1,
              "unit": "g"
            },
            "vitamins": [
              {
                "name": "a",
                "amount": 1,
                "unit": "g"
              }
            ],
            "additionalInfo": {
              "info": "dsfsdf",
              "remark": "dsfdsfds"
            },
            "fiber": {
              "amount": 1,
              "unit": "g"
            },
            "servingInfo": "1to2people",
            "additiveMap": {
              "Polyols": {
                "amount": 1,
                "unit": "g"
              }
            },
            "allergens": [
              {
                "allergen": "gluten",
                "allergenDesc": "dfsdfds"
              }
            ]
          }
        },
        {
          "itemid": "118807411",
          "itemallowvariation": "0",
          "itemrank": "53",
          "item_categoryid": "500774",
          "item_ordertype": "1,2,3",
          "item_tags": [
        ],
          "item_packingcharges": "",
          "itemallowaddon": "0",
          "itemaddonbasedon": "0",
          "item_favorite": "0",
          "ignore_taxes": "0",
          "ignore_discounts": "0",
          "in_stock": "2",
          "variation_groupname": "",
          "variation": [

          ],
          "addon": [

          ],
          "itemname": "Chocolate cake",
          "item_attributeid": "1",
          "itemdescription": "",
          "minimumpreparationtime": "",
          "price": "310",
          "active": "1",
          "item_image_url": "",
          "item_tax": "21866,21867",
          "nutrition": {
            "sodium": {
              "amount": 1,
              "unit": "Mg"
            },
            "carbohydrate": {
              "amount": 1,
              "unit": "G"
            },
            "totalSugar": {
              "amount": 1,
              "unit": "G"
            },
            "addedSugar": {
              "amount": 1,
              "unit": "G"
            },
            "cholesterol": {
              "amount": 1,
              "unit": "G"
            },
            "vitamins": [
              {
                "name": "a",
                "amount": 1,
                "unit": "G"
              }
            ],
            "additionalInfo": {
              "info": "dsfsdf",
              "remark": "dsfdsfds"
            },
            "fiber": {
              "amount": 1,
              "unit": "G"
            },
            "servingInfo": "1to2people"
          }
        },
        {
          "itemid": "7765809",
          "itemallowvariation": "0",
          "itemrank": "52",
          "item_categoryid": "500773",
          "item_ordertype": "1,2,3",
          "item_tags": [
        ],
          "item_packingcharges": "",
          "itemallowaddon": "0",
          "itemaddonbasedon": "0",
          "item_favorite": "0",
          "ignore_taxes": "0",
          "ignore_discounts": "0",
          "in_stock": "2",
          "variation_groupname": "",
          "variation": [
            {
              "id": "7765862",
              "variationid": "89058",
              "name": "3Pieces",
              "groupname": "Quantity",
              "price": "140",
              "active": "1",
              "item_packingcharges": "20",
              "variationrank": "1",
              "addon": [

              ],
              "variationallowaddon": 0
            },
            {
              "id": "7765097",
              "variationid": "89059",
              "name": "6Pieces",
              "groupname": "Quantity",
              "price": "160",
              "active": "1",
              "item_packingcharges": "20",
              "variationrank": "3",
              "addon": [

              ],
              "variationallowaddon": 0
            }
          ],
          "addon": [

          ],
          "itemname": "Garlic Bread",
          "item_attributeid": "1",
          "itemdescription": "",
          "minimumpreparationtime": "",
          "price": "140",
          "active": "1",
          "item_image_url": "",
          "item_tax": "11213,20375",
          "nutrition":{}
        }
    ],
    "variations": [
        {
          "variationid": "104220",
          "name": "Large",
          "groupname": "Quantity",
          "status": "1"
        },
        {
          "variationid": "104221",
          "name": "Small",
          "groupname": "Quantity",
          "status": "1"
        },
        {
          "variationid": "89058",
          "name": "3Pieces",
          "groupname": "Quantity",
          "status": "1"
        },
        {
          "variationid": "89059",
          "name": "6Pieces",
          "groupname": "Quantity",
          "status": "1"
        }
    ],
    "addongroups": [
        {
          "addongroupid": "135699",
          "addongroup_rank": "3",
          "active": "1",
          "addongroupitems": [
            {
              "addonitemid": "1150783",
              "addonitem_name": "Mojito",
              "addonitem_price": "0",
              "active": "1",
              "attributes": "1",
              "addonitem_rank": "1"
            },
            {
              "addonitemid": "1150784",
              "addonitem_name": "Hazelnut Mocha",
              "addonitem_price": "10",
              "active": "1",
              "attributes": "1",
              "addonitem_rank": "1"
            }
          ],
          "addongroup_name": "Add Beverage"
        },
        {
          "addongroupid": "135707",
          "addongroup_rank": "15",
          "active": "1",
          "addongroupitems": [
            {
              "addonitemid": "1150810",
              "addonitem_name": "Egg",
              "addonitem_price": "20",
              "active": "1",
              "attributes": "24",
              "addonitem_rank": "1"
            },
            {
              "addonitemid": "1150811",
              "addonitem_name": "Jalapenos",
              "addonitem_price": "20",
              "active": "1",
              "attributes": "1",
              "addonitem_rank": "1"
            },
            {
              "addonitemid": "1150812",
              "addonitem_name": "Onion Rings",
              "addonitem_price": "20",
              "active": "1",
              "attributes": "1",
              "addonitem_rank": "1"
            },
            {
              "addonitemid": "1150813",
              "addonitem_name": "Cheese",
              "addonitem_price": "10",
              "active": "1",
              "attributes": "1",
              "addonitem_rank": "1"
            }
          ],
          "addongroup_name": "Extra Toppings"
        }
    ],
    "attributes": [
        {
          "attributeid": "1",
          "attribute": "veg",
          "active": "1"
        },
        {
          "attributeid": "2",
          "attribute": "non-veg",
          "active": "1"
        },
        {
          "attributeid": "24",
          "attribute": "egg",
          "active": "1"
        }
    ],
    "discounts": [
        {
          "discountid": "363",
          "discountname": "Introductory Off",
          "discounttype": "1",
          "discount": "10",
          "discountordertype": "1,2,3",
          "discountapplicableon": "Items",
          "discountdays": "All",
          "active": "1",
          "discountontotal": "0",
          "discountstarts": "",
          "discountends": "",
          "discounttimefrom": "",
          "discounttimeto": "",
          "discountminamount": "",
          "discountmaxamount": "",
          "discounthascoupon": "0",
          "discountcategoryitemids": "7765809,7765862,7765097,118807411",
          "discountmaxlimit": ""
        }
    ],
    "taxes": [
        {
          "taxid": "11213",
          "taxname": "CGST",
          "tax": "2.5",
          "taxtype": "1",
          "tax_ordertype": "1,2,3",
          "active": "1",
          "tax_coreortotal": "2",
          "tax_taxtype": "1",
          "rank": "1",
          "consider_in_core_amount": "0",
          "description": ""
        },
        {
          "taxid": "20375",
          "taxname": "SGST",
          "tax": "2.5",
          "taxtype": "1",
          "tax_ordertype": "1,2,3",
          "active": "1",
          "tax_coreortotal": "2",
          "tax_taxtype": "1",
          "rank": "2",
          "consider_in_core_amount": "0",
          "description": ""
        },
        {
          "taxid": "21866",
          "taxname": "CGST",
          "tax": "9",
          "taxtype": "1",
          "tax_ordertype": "1",
          "active": "1",
          "tax_coreortotal": "2",
          "tax_taxtype": "1",
          "rank": "5",
          "consider_in_core_amount": "0",
          "description": ""
        },
        {
          "taxid": "21867",
          "taxname": "SGST",
          "tax": "9",
          "taxtype": "1",
          "tax_ordertype": "1",
          "active": "1",
          "tax_coreortotal": "2",
          "tax_taxtype": "1",
          "rank": "6",
          "consider_in_core_amount": "0",
          "description": ""
        }
    ],
    "serverdatetime": "2022-01-1811:33:13",
    "db_version": "1.0",
    "application_version": "4.0",
    "http_code": 200
}
```

## 2. Save Order

### Request

headers
```
Content-Type: application/json
```
body
```
{
    "app_key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "app_secret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "access_token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "orderinfo": {
        "OrderInfo": {
            "Restaurant": {
                "details": {
                  "res_name": "Dynamite Lounge",
                  "address": "2nd Floor, Reliance Mall, Nr.Akshar Chowk",
                  "contact_information": "9427846660",
                  "restID": "xxxxxx"
                }
            },
        "Customer": {
            "details": {
              "email": "xxx@yahoo.com",
              "name": "Advait",
              "address": "2, Amin Society, Naranpura",
              "phone": "9090909090",
              "latitude": "34.11752681212772",
              "longitude": "74.72949172653219"
            }
        },
        "Order": {
            "details": {
              "orderID": "A-1",
              "preorder_date": "2022-01-01",
              "preorder_time": "15:50:00",
              "service_charge": "0",
              "sc_tax_amount": "0",
              "delivery_charges": "50",
              "dc_tax_amount": "2.5",
              "dc_gst_details": [
                {
                  "gst_liable": "vendor",
                  "amount": "2.5"
                },
                {
                  "gst_liable": "restaurant",
                  "amount": "0"
                }
              ],
              "packing_charges": "20",
              "pc_tax_amount": "1",
              "pc_gst_details": [
                {
                  "gst_liable": "vendor",
                  "amount": "1"
                },
                {
                  "gst_liable": "restaurant",
                  "amount": "0"
                }
              ],
              "order_type": "H",
              "ondc_bap" : "buyerAppName",
              "advanced_order": "N",
              "urgent_order": false,
              "urgent_time" : 20,
              "payment_type": "COD",
              "table_no": "",
              "no_of_persons": "0",
              "discount_total": "45",
              "tax_total": "65.52",
              "discount_type": "F",
              "total": "560",
              "description": "",
              "created_on": "2022-01-01 15:49:00",
              "enable_delivery": 1,
              "min_prep_time": 20,
              "callback_url": "https.xyz.abc",
              "collect_cash": "480",
              "otp": "9876"
            }
        },
        "OrderItem": {
            "details": [
                  {
                    "id": "7765862",
                    "name": "Garlic Bread (3Pieces)",
                    "gst_liability": "vendor",
                    "item_tax": [
                      {
                        "id": "11213",
                        "name": "CGST",
                        "amount": "3.15"
                      },
                      {
                        "id": "20375",
                        "name": "SGST",
                        "amount": "3.15"
                      }
                    ],
                    "item_discount": "14",
                    "price": "140.00",
                    "final_price": "126",
                    "quantity": "1",
                    "description": "",
                    "variation_name": "3Pieces",
                    "variation_id": "89058",
                    "AddonItem": {
                      "details": [

                      ]
                    }
                  },
                  {
                    "id": "118829149",
                    "name": "Veg Loaded Pizza",
                    "gst_liability": "vendor",
                    "item_tax": [
                      {
                        "id": "11213",
                        "name": "CGST",
                        "amount": "2.75"
                      },
                      {
                        "id": "20375",
                        "name": "SGST",
                        "amount": "2.75"
                      }
                    ],
                    "item_discount": "",
                    "price": "110.00",
                    "final_price": "110.00",
                    "quantity": "1",
                    "description": "",
                    "variation_name": "",
                    "variation_id": "",
                    "AddonItem": {
                      "details": [
                        {
                          "id": "1150783",
                          "name": "Mojito",
                          "group_name": "Add Beverage",
                          "price": "0",
                          "group_id": 135699,
                          "quantity": "1"
                        },
                        {
                          "id": "1150813",
                          "name": "Cheese",
                          "group_name": "Extra Toppings",
                          "price": "10",
                          "group_id": 135707,
                          "quantity": "1"
                        }
                      ]
                    }
                },
                {
                    "id": "118807411",
                    "name": "Chocolate Cake",
                    "gst_liability": "restaurant",
                    "item_tax": [
                      {
                        "id": "21866",
                        "name": "CGST",
                        "amount": "25.11"
                      },
                      {
                        "id": "21867",
                        "name": "SGST",
                        "amount": "25.11"
                      }
                    ],
                    "item_discount": "31",
                    "price": "310.00",
                    "final_price": "279",
                    "quantity": "1",
                    "description": "",
                    "variation_name": "",
                    "variation_id": "",
                    "AddonItem": {
                      "details": [

                      ]
                    }
                  }
            ]
        },
        "Tax": {
            "details": [
              {
                "id": "11213",
                "title": "CGST",
                "type": "P",
                "price": "2.5",
                "tax": "5.9",
                "restaurant_liable_amt": "0.00"
              },
              {
                "id": "20375",
                "title": "SGST",
                "type": "P",
                "price": "2.5",
                "tax": "5.9",
                "restaurant_liable_amt": "0.00"
              },
              {
                "id": "21866",
                "title": "CGST",
                "type": "P",
                "price": "9",
                "tax": "25.11",
                "restaurant_liable_amt": "25.11"
              },
              {
                "id": "21867",
                "title": "SGST",
                "type": "P",
                "price": "9",
                "tax": "25.11",
                "restaurant_liable_amt": "25.11"
              }
            ]
        },
        "Discount": {
            "details": [
              {
                "id": "362",
                "title": "Discount",
                "type": "F",
                "price": "45"
              }
            ]
        }
    },
    "udid": "",
    "device_type": "Web"
    }
}
```

### Schema:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "app_key": {
      "type": "string"
    },
    "app_secret": {
      "type": "string"
    },
    "access_token": {
      "type": "string"
    },
    "res_name": {
      "type": "string"
    },
    "address": {
      "type": "string"
    },
    "Contact_information": {
      "type": "string"
    },
    "restID": {
      "type": "string"
    },
    "OrderInfo / Customer": {
      "type": "object",
      "properties": {
        "email": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "address": {
          "type": "string"
        },
        "phone": {
          "type": "string"
        },
        "latitude": {
          "type": "string"
        },
        "longitude": {
          "type": "string"
        }
      }
    },
    "OrderInfo / Order": {
      "type": "object",
      "properties": {
        "orderID": {
          "type": "string"
        },
        "preorder_date": {
          "type": "string"
        },
        "preorder_time": {
          "type": "string"
        },
        "delivery_charges": {
          "type": "string"
        },
        "order_type": {
          "type": "string"
        },
        "ondc_bap": {
          "type": "string"
        },
        "advanced_order": {
          "type": "string"
        },
        "urgent_order": {
          "type": "boolean"
        },
        "urgent_time": {
          "type": "number"
        },
        "payment_type": {
          "type": "string"
        },
        "table_no": {
          "type": "string"
        },
        "no_of_persons": {
          "type": "string"
        },
        "discount_total": {
          "type": "string"
        },
        "discount": {
          "type": "string"
        },
        "discount_type": {
          "type": "string"
        },
        "total": {
          "type": "string"
        },
        "tax_total": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "created_on": {
          "type": "string"
        },
        "packing_charges": {
          "type": "string"
        },
        "min_prep_time": {
          "type": "number"
        },
        "callback_url": {
          "type": "string"
        },
        "collect_cash": {
          "type": "string"
        },
        "otp": {
          "type": "string"
        },
        "enable_delivery": {
          "type": "number"
        },
        "service_charge": {
          "type": "string"
        },
        "sc_tax_amount": {
          "type": "string"
        },
        "dc_tax_amount": {
          "type": "string"
        },
        "dc_gst_details": {
          "type": "object",
          "properties": {
            "gst_liable": {
              "type": "string"
            },
            "amount": {
              "type": "string"
            }
          }
        },
        "pc_tax_amount": {
          "type": "string"
        },
        "pc_gst_details": {
          "type": "object",
          "properties": {
            "gst_liable": {
              "type": "string"
            },
            "amount": {
              "type": "string"
            }
          }
        }
      },
      "required": [
        "orderID",
        "preorder_date",
        "preorder_time",
        "order_type",
        "payment_type",
        "created_on",
        "service_charge",
        "sc_tax_amount",
        "dc_tax_amount",
        "pc_tax_amount"
      ]
    },
    "OrderInfo/ OrderItem": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "gst_liability": {
          "type": "string"
        },
        "item_tax": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "amount": {
              "type": "string"
            }
          }
        },
        "item_discount": {
          "type": "string"
        },
        "final_price": {
          "type": "string"
        },
        "price": {
          "type": "string"
        },
        "quantity": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "variation_name": {
          "type": "string"
        },
        "variation_id": {
          "type": "string"
        }
      },
      "required": [
        "name",
        "item_tax",
        "item_discount",
        "final_price",
        "price",
        "quantity"
      ]
    },
    "OrderInfo/ OrderItem / AddonItem": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "group_name": {
          "type": "string"
        },
        "price": {
          "type": "string"
        },
        "group_id": {
          "type": "string"
        },
        "quantity": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "name",
        "group_name",
        "price",
        "group_id"
      ]
    },
    "OrderInfo/Tax": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "type": {
          "type": "string"
        },
        "price": {
          "type": "string"
        },
        "tax": {
          "type": "string"
        },
        "restaurant_liable_amt": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "title",
        "price"
      ]
    },
    "OrderInfo/ Discount": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "type": {
          "type": "string"
        },
        "price": {
          "type": "string"
        }
      },
      "required": [
        "title",
        "price"
      ]
    },
    "udid": {
      "type": "string"
    },
    "device_type": {
      "type": "string"
    }
  },
  "required": [
    "app_key",
    "app_secret",
    "access_token",
    "restID",
    "device_type"
  ]
}
```


### Response
```json
{
    "success":"1",
    "message":"Your order is saved.",
    "restID":"xxxxxx",
    "clientOrderID":"A-1",
    "orderID":"26"
}
```
