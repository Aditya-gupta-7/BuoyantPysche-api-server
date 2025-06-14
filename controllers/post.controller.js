import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import ImageKit from 'imagekit';
import dotenv from 'dotenv';
dotenv.config();

export const getPosts = async (req,res)=>{

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 2;


    const query = {};

    const cat=req.query.cat;
    const author=req.query.author;
    const searchQuery=req.query.search;
    const sortQuery=req.query.sort;
    const featured=req.query.featured;

    if(cat){
        query.category = cat;
    }
            
    if(searchQuery){
        query.title = { $regex: searchQuery, $options: 'i' }; 
    }


    if(author){
        const user = await User.findOne({username: author}).select('_id');
        if(!user){
            return res.status(404).json({message: "User not found"});
        }
        query.user = user._id;
    }

    let sortObj = {createdAt: -1}; // default sort by newest

    if(sortQuery){
        switch(sortQuery){
            case "newest":
                sortObj = { createdAt: -1 };
                break;
            case "oldest":
                sortObj = { createdAt: 1 };
                break;
            case "popular":
                sortObj = { visits: -1 };
                break;
            case "trending":
                sortObj = { visits: -1, createdAt: -1 }; // trending by visits and then by newest
                break;
        }
    }

    if(featured){
        query.isFeatured = true;
    }
    
    const posts = await Post.find(query)
    .populate("user", "username")
    .sort(sortObj)
    .limit(limit)
    .skip((page-1)*limit);

    const totalPosts = await Post.countDocuments();
    const hasMore = page * limit<totalPosts;
    res.status(200).json({posts, hasMore});
 
}

export const getPost = async (req,res)=>{
    const post = await Post.findOne({slug:req.params.slug}).populate("user", "username img");
    res.status(200).json(post)
}

export const createPost = async (req,res)=>{
    const clerkUserId = req.auth.userId;

    console.log(req.headers)

    if(!clerkUserId){
        return res.status(401).json({message: "Unauthorized"})
    }

    const user=await User.findOne({clerkUserId}); 
    if(!user){
        return res.status(401).json({message: "Unauthorized"})
    }
    let slug = req.body.title.replace(/ /g, '-').toLowerCase();
    let existSlug = await Post.findOne({slug});
    let counter=2;
    while(existSlug){
        slug = `${slug}-${counter}`;
        existSlug = await Post.findOne({slug});
        counter++;
    }
    const newPost=new Post({user: user._id ,slug, ...req.body});
    const post = await newPost.save();
    res.status(200).json(post);
}

export const deletePost = async (req,res)=>{
    const clerkUserId = req.auth.userId;
    if(!clerkUserId){
        return res.status(401).json({message: "Unauthorized"})
    }

    const role = req.auth.sessionClaims?.metadata?.role || "user";

    if(role==="admin"){
        await Post.findByIdAndDelete(req.params.id);
        return res.status(200).json("Post has been deleted");
    }

    const user=await User.findOne({clerkUserId});

    const deletedPost = await Post.findOneAndDelete({_id: req.params.id, user: user._id});

    if(!deletedPost){
        return res.status(403).json({message: "You can delete only your posts!"})
    }
    res.status(200).json("Post has been deleted");
}

export const featurePost = async (req,res)=>{
    const clerkUserId = req.auth.userId;
    const postId = req.body.postId;
    if(!clerkUserId){
        return res.status(401).json({message: "Unauthorized"})
    }

    const role = req.auth.sessionClaims?.metadata?.role || "user";

    if(role!=="admin"){
        return res.status(403).json("You cannot feature posts");
    }

    const post = await Post.findById(postId);

    if(!post){
        return res.status(404).json("Post not found");
    }
    
    const isFeatured = post.isFeatured;

    const updatedPost = await Post.findByIdAndUpdate(postId, {
        isFeatured: !isFeatured,
    }, {new: true});
    res.status(200).json(updatedPost);
}

const imagekit = new ImageKit({
    urlEndpoint: process.env.IK_URL_ENDPOINT,
    publicKey: process.env.IK_PUBLIC_KEY,
    privateKey: process.env.IK_PRIVATE_KEY,
})

export const uploadAuth = async (req,res)=>{
    try {
        const result = imagekit.getAuthenticationParameters();
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}