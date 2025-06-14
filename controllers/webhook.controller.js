import User from "../models/user.model.js";
import { Webhook } from "svix";

export const clerkWebhook = async (req, res) => {
    // console.log("Webhook received");
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    // console.log("Webhook secret:", WEBHOOK_SECRET);
    if(!WEBHOOK_SECRET){
        throw new Error("Webhook secret is not set");
    }
    // console.log("Webhook received");
    const payload = req.body;
    const headers = req.headers;
    // console.log("Headers:", req.headers);
    // console.log("Raw Payload:", req.body);

    const wh= new Webhook(WEBHOOK_SECRET);
    let evt;
    try{
        evt = wh.verify(payload, headers);
    }
    catch(err){
        return res.status(400).json({message:"Webhook verification",})
    }
    console.log(evt.data)
    if(evt.type==="user.created"){
        const newUser = new User({
            clerkUserId: evt.data.id,
            username: evt.data.username || evt.data.email_addresses[0].email_address,
            email: evt.data.email_addresses[0].email_address,
            img: evt.data.profile_img_url,
        });

        await newUser.save();
    }

    return res.status(200).json({message:"Webhook received",})
}