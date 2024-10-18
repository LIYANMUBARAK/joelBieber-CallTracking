import { Request, Response } from "express";
import path from "path";
import pool from '../shared/dbConnectionPool';


export async function getForm(req:Request,res:Response){
   res.sendFile(path.join(__dirname,'../public/html/form.html'))
}

export async function formSubmit(req:Request,res:Response){
    const { phoneNumber, sourceTag, campaignTag, vendorTag, locationTag, caseTypeTag, mediumTag} = req.body
    let connection = await pool.getConnection();
    try {
        

        const query = `
        INSERT INTO phoneData 
        (phone_number, source_tag, campaign_tag, vendor_tag, location_tag, case_type_tag, medium_tag) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // Execute the query with the values from the request body
    await connection.query(query, [phoneNumber, sourceTag, campaignTag, vendorTag, locationTag, caseTypeTag, mediumTag]);

    // Send a success response
    res.status(200).send("Data inserted successfully.");

    } catch (error) {
        console.log("error in the formSubmission : "+error)
    }finally {
        // Release the connection back to the pool
        if (connection) connection.release();
    }
}

export async function getPayload(req:Request,res:Response){
    console.log("payload: " + JSON.stringify(req.body, null, 2));
    res.status(200).send("Payload recieved successfully")
}