import { Request, Response } from "express";
import path from "path";
import pool from '../shared/dbConnectionPool';
import axios from "axios";
import { fetchAuthTokenForLocation } from "./authController";
import fs from 'fs';



export async function getForm(req:Request,res:Response){
   res.sendFile(path.join(__dirname,'../public/html/form.html'))
}

export async function formSubmit(req: Request, res: Response) {
    const { phoneNumber, sourceTag, campaignTag, vendorTag, locationTag, caseTypeTag, mediumTag } = req.body;
    let connection = await pool.getConnection();
    
    try {
        // Check if the phone number already exists in the table
        const checkQuery = 'SELECT COUNT(*) as count FROM phoneData WHERE phone_number = ?';
        const [rows] :any= await connection.query(checkQuery, [phoneNumber]);

        if (rows[0].count > 0) {
            // If phone number exists, update the existing record
            const updateQuery = `
                UPDATE phoneData 
                SET source_tag = ?, campaign_tag = ?, vendor_tag = ?, location_tag = ?, case_type_tag = ?, medium_tag = ?
                WHERE phone_number = ?
            `;
            await connection.query(updateQuery, [sourceTag, campaignTag, vendorTag, locationTag, caseTypeTag, mediumTag, phoneNumber]);
            res.status(200).send("Data updated successfully.");
        } else {
            // If phone number does not exist, insert a new record
            const insertQuery = `
                INSERT INTO phoneData 
                (phone_number, source_tag, campaign_tag, vendor_tag, location_tag, case_type_tag, medium_tag) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            await connection.query(insertQuery, [phoneNumber, sourceTag, campaignTag, vendorTag, locationTag, caseTypeTag, mediumTag]);
            res.status(200).send("Data inserted successfully.");
        }

    } catch (error) {
        console.log("Error in formSubmit:", error);
        res.status(500).send("Error processing request.");
    } finally {
        // Release the connection back to the pool
        if (connection) connection.release();
    }
}

// Function to retrieve and display table data
export async function viewTableData(req: Request, res: Response) {
    let connection = await pool.getConnection();

    try {
        const query = 'SELECT * FROM phoneData';
        const [rows] = await connection.query(query) as any[];

        // Read the HTML template from the file
        const htmlTemplate = fs.readFileSync(path.join(__dirname, '../public/html', 'viewTable.html'), 'utf-8');

        // Generate table rows
        let tableRows = '';
        rows.forEach((row: any) => {
            tableRows += `
                <tr>
                    <td>${row.phone_number}</td>
                    <td>${row.source_tag}</td>
                    <td>${row.campaign_tag}</td>
                    <td>${row.vendor_tag}</td>
                    <td>${row.location_tag}</td>
                    <td>${row.case_type_tag}</td>
                    <td>${row.medium_tag}</td>
                </tr>`;
        });

        // Inject table rows into the HTML template
        const finalHtml = htmlTemplate.replace('<!-- Rows will be injected here -->', tableRows);

        // Send the final HTML as the response
        res.send(finalHtml);

    } catch (error) {
        console.log("Error retrieving table data:", error);
        res.status(500).send("Error retrieving data.");
    } finally {
        if (connection) connection.release();
    }
}


export async function getPayload(req:Request,res:Response){
    console.log("payload: " + JSON.stringify(req.body, null, 2));
    const query = 'INSERT INTO api_logs (request) VALUES (?)';
    const requestJson = JSON.stringify(req.body,null,2);
    let connection = await pool.getConnection();

    const [result]:any= await connection.execute(query, [requestJson]);
    const recordId = result.insertId
    
    const {locationId,contactId} = req.body
    console.log("contactId : "+contactId)
    const currentDate = new Date();
    const three_days_ago = new Date(currentDate);
    three_days_ago.setDate(currentDate.getDate() - 3);
    
 
    const three_days_ago_string = three_days_ago.toISOString().split('T')[0]; 
    const currentDateToString = currentDate.toISOString().split('T')[0];  
    
    const id_token:string = await getIdToken() as string
    console.log(id_token)

    const callData = await getAllCalls(id_token,locationId,three_days_ago_string,currentDateToString,contactId,recordId)
    if(!callData){
        res.status(200).send("Call data not found")
    }else{
        const toPhoneNumber = callData.to
        await updateContactWithTags(toPhoneNumber,contactId,locationId,recordId)
        res.status(200).send("Payload recieved successfully")
    }

  
}
async function getIdToken(): Promise<string | undefined> {
    const url = "https://securetoken.googleapis.com/v1/token?key=AIzaSyB_w3vXmsI7WeQtrIOkjR6xTRVN5uOieiE";
    const payload = 'grant_type=refresh_token&refresh_token=AMf-vBwPJoZiBIoCPOQQyv3pjjT2LSRUTu9Ur7DhwKqa0KwAZfyAf4LIiND4-rWtlmUN_ylN839zj0yayZPM3xYQq6OijcZZsP2LKLh5DVgAecsMr6X1vmFMixd80droDE1fGD32ur4bD8alKFoxf-GjdwOz4AV_Kkcm8zDDEYJ_iWTtMRx6QFJ7iLRxr977p2YjdsQV-RXxHRECN__waCPPjwNllE0KS61Qj380dW0V_mGvVSf6xaXru20P4wjcYnY22aaxUckfDc_HjzzcRv3nhojPIZI0_W2sPx2-7T4UK-UvCS3uVkun_Vj_mz707AbXp6_bf5VHKBPmVh7o2c7QrHSk1N3zBgKEOT6Pp5u1wXeodtImqjqA7cL0hrIeNHhr9Cy4TNeH8d6bqySFxQVJx8FGGdroFoYmLj7ZDhNEZxShGFrfGRjIBGX5_D8H3AY3bJOM-9G1-skgPx-fB-XR-97YSTyqyw';
    
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: payload
        });

        const responseJson = await response.json();
        const idToken = responseJson['id_token'];
        console.log('ID Token:', idToken);
        return idToken;
    } catch (error) {
        console.error('Id token fetch error[ in getIdToken() function ] : ', error);
        return '';
    }
}

async function getAllCalls(idToken:string, ghl_location_id:string, three_days_ago_string:string, dt_string:string, contactId:string,recordId:string) {
    let connection = await pool.getConnection();

    const url = 'https://backend.leadconnectorhq.com/reporting/calls/get-all-phone-calls-new';
    const payload = {
        locationId: ghl_location_id,
        source: [],
        sourceType: [],
        keyword: [],
        landingPage: [],
        referrer: [],
        campaign: [],
        callStatus: [],
        deviceType: [],
        qualifiedLead: false,
        firstTime: false,
        duration: null,
        selectedPool: "all",
        direction: null,
        startDate: three_days_ago_string,
        endDate: dt_string,
        userId: "",
        limit: 1000,
        skip: 0
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Channel': 'APP',
                'Source': 'WEB_USER',
                'Version': '2021-04-15',
                'token-id': idToken
            }
        });

        const responseData = response.data;

        // Filter rows based on contactId and firstTime:true
        const filteredRows = responseData.rows.filter((row: any) => 
            row.contactId === contactId &&  row.firstTime === true
         
        );

        if(filteredRows.length){
            console.log(filteredRows[0])
           
            const updateQuery = 'UPDATE api_logs SET callRecordsPayload = ? WHERE id = ?';
            await connection.execute(updateQuery, [JSON.stringify(filteredRows[0]), recordId]);
            return filteredRows[0]
        }else{
            console.warn("Call data not found")
            return undefined
        }
        

    } catch (error) {
        console.error('Error fetching calls:', error);
    }
}

async function updateContactWithTags(to_phone_number:any,contactId:string,locationId:string,recordId:string){
    const accessToken = await fetchAuthTokenForLocation(locationId)

    let connection = await pool.getConnection();

    const query = 'SELECT * FROM phoneData WHERE phone_number = ?';

    try {
        const [rows]:any = await connection.execute(query, [to_phone_number]); // Await the execution of the query

        if (rows.length===0) {
            console.log("No phone record found in the database");
            return
        } else {
            console.log("Record found:", rows);
            const tags = rows[0]
            const tagsArr=[]
            for(let key in tags){
                if(key!=="phone_number") tagsArr.push(tags[key])
               
            }
           
            const oldTags =  await getOldTagsOfContactId(contactId,locationId)
            
          
            const newTagsToUpdate = oldTags.concat(tagsArr)

            console.log(newTagsToUpdate)

          
            const options = {
                method: 'POST',
                url: `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Version: '2021-07-28',
                  'Content-Type': 'application/json',
                  Accept: 'application/json'
                },
                data: {
                tags:[...newTagsToUpdate]
                }
              };
              
              try {
                const { data } = await axios.request(options);
                console.log(data)
                const updateQuery = 'UPDATE api_logs SET response = ? WHERE id = ?';
                await connection.execute(updateQuery, [JSON.stringify(data), recordId]);
              } catch (error:any) {
                console.error("error updating tags to contact : "+error.message);
              }
        }
    } catch (error) {
        console.error('Error executing query:', error);
    } finally {
        connection.release(); 
    }
}

async function getOldTagsOfContactId(contactId:string,locationId:string){

      const accessToken = await fetchAuthTokenForLocation(locationId)

      const options = {
                method: 'GET',
                url: `https://services.leadconnectorhq.com/contacts/${contactId}`,
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Version: '2021-07-28',
                  'Content-Type': 'application/json',
                  Accept: 'application/json'
                }
              };
              
              try {
                const { data } = await axios.request(options);
              
                return data.contact.tags
              } catch (error) {
                console.error("error updating tags to contact : "+error);
              }

}