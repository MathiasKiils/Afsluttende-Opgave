import fetch from 'node-fetch';
import {createAdminApiClient} from '@shopify/admin-api-client';
import '@shopify/admin-api-client';


//Brugt til at hente data fra airtable og skabe segmenterne inde i shopify automatisk.
//_________________________________________________________________________________createSegments()____________________________________________________________________________________________
let dataPartner = null
let partnerList = []

let domains = ["live.dk", "gmail.com", "hotmail.com", "outlook.dk", "mac.com", "yahoo.com", "aol.com", "msn.com", "pm.me", "protonmail.com", "me.com", "icloud.com", undefined]
let query = '';
let hasReachedEnd = false;

let text = "customer_email_domain = '"

let TestSegmentName = "TestSegment"

let queryShopify = ""

let almostArray = null

let segmentText = null

async function fetchPart(query) {
  let bt = 'AUTH';
  let b = 'PART1';
  let t = 'PART2';
  let queryFinal = !!query ? query : '';
  let response = await fetch(`https://api.airtable.com/v0/${b}/${t}?${queryFinal}`, {
    headers: {
      Authorization: `Bearer ${bt}`
    }
  });
  return response;
}


async function createAndImplementSegments(){
  do {
    dataPartner = await fetchPart(query)
    let jsonResponse = await dataPartner.json()
    partnerList = [...partnerList, ...jsonResponse.records]
  
    if (jsonResponse.hasOwnProperty('offset')) {
      query = `offset=${jsonResponse.offset}`;
    } else {
      hasReachedEnd = true;
    }
  }
  while (!hasReachedEnd);
    let emaildomains = partnerList.map(partner => {
      let string = partner.fields?.Maildomain?.replace('@', '')
      return string 
    })
    
    let newDomainList
  
    for (let i = 0; i < domains.length; i++) {
      newDomainList = emaildomains.filter((currentDomain) => (!domains.includes(currentDomain)))
    }
  
  
    const perChunk = 10 // Hvor mange vi vil have sat sammen  
    
    const result = newDomainList.reduce((resultArray, item, index) => { 
      const chunkIndex = Math.floor(index/perChunk)
    
      if(!resultArray[chunkIndex]) {
        resultArray[chunkIndex] = [] // Lav en ny gruppe af domæner
      }
    
      resultArray[chunkIndex].push(item)
    
      return resultArray
    }, [])
  
  
    almostArray = result[0].toString().replaceAll(",", "' OR '")

    segmentText = text + " " + almostArray

    let s = null

    for (s = 0; s < result.length; s++) {
      almostArray = result[s].toString().replaceAll(",", "' OR customer_email_domain = '")
      segmentText = text + almostArray + "'"
      TestSegmentName = "TestSegmentName" + s
      queryShopify = segmentText
      

      const client = createAdminApiClient({
        storeDomain: 'WEBSITE.myshopify.com',
        apiVersion: '2024-01',
        accessToken: 'ACCESSTOKEN',
      });
    
      const productQuery = `
      mutation segmentCreate($name: String!, $query: String!) {
        segmentCreate(name: $name, query: $query) {
          segment {
            name
            query
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    const {data, errors, extensions} = await client.request(productQuery, {
      variables: {
        name: TestSegmentName,
        query: queryShopify
      },
    });
    }




    let request = await fetch("https://WEBSITE.myshopify.com/admin/api/2024-01/graphql.json", {
    method: "POST",
    body: JSON.stringify({
        query: `{
            segments(first: 100) {
                edges {
                    node {
                        name
                        id
                    }
                }
            }
    }`
    }),
    headers: {
    "X-Shopify-Access-Token": "ACCESSTOKEN",
    "Content-Type": "application/json; charset=UTF-8"
    }
    });

    let awaitRequest = await request.json()

    let answer = awaitRequest.data.segments.edges

    let idArray = []

    const segmentNames2 = answer.map(item => item.node.name)
    const segmentIds2 = answer.map(item => item.node.id)
    for (let f = 0; f < segmentNames2.length; f++) {
        if (segmentNames2[f].includes("TestSegmentName")) {
            idArray.push(segmentIds2[f])
          }
    }


    for (let q = 0; q < idArray.length; q++) {
        const client = createAdminApiClient({
            storeDomain: 'WEBSITE.myshopify.com',
            apiVersion: '2024-01',
            accessToken: 'ACCESSTOKEN',
          });
           
           
          const mutation = `
          mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
            discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
              codeDiscountNode {
                codeDiscount {
                  ... on DiscountCodeBasic {
                    title
                    codes(first: 10) {
                      nodes {
                        code
                      }
                    }
                    startsAt
                    endsAt
                    customerSelection {
                      ... on DiscountCustomerAll {
                        allCustomers
                      }
           
                    }
                    customerGets {
                      value {
                        ... on DiscountPercentage {
                          percentage
                        }
                      }
                      items {
                        ... on AllDiscountItems {
                          allItems
                        }
                      }
                    }
                    appliesOncePerCustomer
                  }
                }
              }
              userErrors {
                field
                code
                message
              }
            }
          }
          `;
           
          const variables = {
            "variables": {
              "id": "DISCOUNTCODEID",
              "basicCodeDiscount": {
                "endsAt": null,
                "customerSelection": {
                  "customerSegments": {
                    "add": [idArray[q]]
                  }
                }
                // Include other necessary fields as per your discount setup
              }
            }
          };
          const { data, errors, extensions } = await client.request(mutation, variables);
                 
    } 

    return;
}
//_________________________________________________________________________________createSegments()____________________________________________________________________________________________


//______________________________________________________________________________getSegmentNamesAndDel()___________________________________________________________________________________________________
let request = await fetch("https://WEBSITE.myshopify.com/admin/api/2024-01/graphql.json", {
  method: "POST",
  body: JSON.stringify({
    query: `{
            segments(first: 100) {
                edges {
                    node {
                        name
                        id
                    }
                }
            }
    }`
    }),
  headers: {
    "X-Shopify-Access-Token": "ACCESSTOKEN",
    "Content-Type": "application/json; charset=UTF-8"
  }
});

let awaitRequest = await request.json()

let answer = awaitRequest.data.segments.edges

let idArray = []


async function getSegmentNamesAndDel() {
  const segmentNames = answer.map(item => item.node.name)
  const segmentIds = answer.map(item => item.node.id)
  for (let i = 0; i < answer.length; i++) {
    if (segmentNames[i].includes("TestSegmentName")) {
      idArray.push(segmentIds[i])
    }
  
  }

  for (let j = 0; j < idArray.length; j++) {
    const client = createAdminApiClient({
      storeDomain: 'WEBSITE.myshopify.com',
      apiVersion: '2024-01',
      accessToken: 'ACCESSTOKEN',
    });
    
    const productQuery = `
    mutation segmentDelete($id: ID!) {
      segmentDelete(id: $id) {
        deletedSegmentId
        userErrors {
          field
          message
        }
      }
    }
    `;
    
    const {data, errors, extensions} = await client.request(productQuery, {
    variables: {
      id: idArray[j]
    },
    });
  
  }
}

//Brugt til at fjerne alle segmenter fra rabatkoden på shopify.
//____________________________________________________________________________deleteSegmentsFromDiscount()______________________________________________________________________________________________________
async function deleteSegmentsFromDiscount(){

    const client = createAdminApiClient({
      storeDomain: 'WEBSITE.myshopify.com',
      apiVersion: '2024-01',
      accessToken: 'ACCESSTOKEN',
    });
     
     
    const mutation = `
    mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 10) {
                nodes {
                  code
                }
              }
              startsAt
              endsAt
              customerSelection {
                ... on DiscountCustomerAll {
                  allCustomers
                }
     
              }
              customerGets {
                value {
                  ... on DiscountPercentage {
                    percentage
                  }
                }
                items {
                  ... on AllDiscountItems {
                    allItems
                  }
                }
              }
              appliesOncePerCustomer
            }
          }
        }
        userErrors {
          field
          code
          message
        }
      }
    }
    `;
     
    const variables = {
      "variables": {
        "id": "DISCOUNTCODEID",
        "basicCodeDiscount": {
          "endsAt": null,
          "customerSelection": {
            "all": true
          }
          // Include other necessary fields as per your discount setup
        }
      }
    };
    const { data, errors, extensions } = await client.request(mutation, variables);
  }

//____________________________________________________________________________deleteSegmentsFromDiscount()______________________________________________________________________________________________________



deleteSegmentsFromDiscount()

getSegmentNamesAndDel()

createAndImplementSegments()
