const express = require("express")
const app = express()
const cors = require("cors")
const mysql = require("mysql2/promise")
const PORT = process.env.PORT || 5000 

const db = mysql.createPool({
    host : "localhost" ,
    user : "root"  ,
    password : /*process.env.SQL_PASSWORD*/ "Steel321$",
    database : "inventory"
})

//enable cross origin resource sharing
app.use(cors({
    origin : ["http://localhost:3000"] ,
    credentials : true 
}))

//parse json
app.use(express.json())

app.get( "/" , (req,res) => {
    res.send("connected to server")
})

app.get( "/getUsernameAndID" , (req,res) => {

    const sqlQuery = "Select username , id from user" 

    db.query( sqlQuery , ( err , result ) => {
        
        if ( err )
        return res.status(400).json({
            ok : false ,
            error : err
        })

        return res.status(200).json({
            ok : true , 
            data : result 
        })

    } ) 
    
})

app.get("/dashboardStats", async (req, res) => {

    let monthlyOrders = 0;
    let totalSale = 0;
    let ordersDelivered = 0;
    let totalProducts = 0;
    const monthlyOrdersQuery = "SELECT COUNT(*) as monthlyOrders FROM `order` WHERE MONTH(createdAt) = MONTH(NOW())";
    const totalSaleQuery = "Select SUM(grandTotal) as totalSale from `order`"
    const ordersDeliveredQuery = "SELECT COUNT(*) as ordersDelivered FROM `order` where status = \"complete\" "
    const totalProductsQuery = "SELECT COUNT(*) as totalProducts from `product` "
  
    try {

        const [ result1 ] = await db.query( monthlyOrdersQuery )
        const [ result2 ] = await db.query( totalSaleQuery )
        const [ result3 ] = await db.query( ordersDeliveredQuery )
        const [ result4 ] = await db.query( totalProductsQuery )

        monthlyOrders = result1[0]['monthlyOrders']
        totalSale = result2[0]['totalSale']
        ordersDelivered = result3[0]['ordersDelivered']
        totalProducts = result4[0]['totalProducts']

        return res.status(200).json({
            ok: true,
            data : { monthlyOrders , totalSale , ordersDelivered , totalProducts }
          })

    } 
    catch (err) {
      return res.status(400).json({
        ok: false,
        error: err.message
      })
    }
  })

app.get("/graphStats" , async ( req , res ) => {
    
    let monthlySales = new Array(12).fill(0)
    let monthlyOrders = new Array(12).fill(0)
    try {
        
        let [ orders ] = await db.query(" Select grandTotal , MONTH(createdAt) as createdAt from `order` ")
        let currentMonth = new Date().getMonth()
        for ( let order of orders )
        {
            //if ( currentMonth + 1 == order.createdAt)
            monthlyOrders[order.createdAt-1]++ , monthlySales[order.createdAt-1] += parseInt(order.grandTotal)
        }

        return res.status(200).json({
            ok: true,
            data : { monthWiseSales : monthlySales , monthWiseOrders : monthlyOrders }
          })
    } 
    catch (err) {
      return res.status(400).json({
        ok: false,
        error: err.message
      })
    }
  


})

app.get("/getPendingOrders" , async ( req , res ) => {
    
    try {

        let [pendingOrders] =
        await db.query("Select `order`.id  , firstName , mobile , userID , status , grandTotal from `order` inner join `user` on userID = `user`.id where status = \"pending\"  " )
        
        return res.status(200).json({
            ok: true,
            data : pendingOrders
          })
    } 
    catch (err) {
      return res.status(400).json({
        ok: false,
        error: err.message
      })
    }
  


})

app.get("/user/getOrders/:id" , async ( req , res ) => {

    try{
        const {id} = req.params 
        console.log("user id: " , id )
        let query = " select * from `order` where userId = ? " ;

        let [ result ] = await db.query( query , [ id ] )
        return res.status(200).json({

            ok : true ,
            data : result

        })

    }
    catch( error )
    {
        return res.status(404).json({

            ok : false ,
            data : [] ,
            error

        })
    }

})

app.put("/completeOrder/:id" , async ( req ,res ) => {

    let {id} = req.params
    console.log(id)
    try{
        let [ result ] = await db.query( " update `order` set status = \"complete\" where id = ? " , [id])
        console.log(result)
        res.status(200).json({
            ok : true ,
            message : "order completed"
        })

    }
    catch(err)
    {
        res.status(400).json({
            ok : false ,
            message : err.message
        })

    }

})

app.put("/cancelOrder/:id" , async ( req ,res ) => {

    let {id} = req.params
    console.log(id)
    try{
        let [ result ] = await db.query( " update `order` set status = \"failed\" where id = ? " , [id])
        console.log(result)
        res.status(200).json({
            ok : true ,
            message : "order cancelled"
        })

    }
    catch(err)
    {
        res.status(400).json({
            ok : false ,
            message : err.message
        })

    }

})


app.get("/getCompletedOrders" , async ( req , res ) => {
    
    try {

        let [completedOrders] =await 
        db.query
        ("Select `order`.id as orderID  , concat(firstName, \" \" , lastName) as name , mobile , userID , status , grandTotal from `order` inner join `user` on userID = `user`.id where status = \"complete\"  " )

        return res.status(200).json({
            ok: true,
            data : completedOrders
          })
    } 
    catch (err) {
      return res.status(400).json({
        ok: false,
        error: err.message
      })
    }
  


})

app.get("/getItems" , async (req , res) => {

    try{
        let [items] = await db.query("select item.id as itemId , productId, product.title , price , available from item  inner join product on item.productId = product.id ")

        res.status(200).json({
            ok : true , 
            data : items
        })

    }
    catch(err)
    {
        res.status(400).json({
            ok : false , 
            error : err.message
        })
    }

})

app.get("/getBrands" , async ( req , res ) => {
    try{
        let [brands] = await db.query("select * from brand ")

        res.status(200).json({
            ok : true , 
            data : brands
        })

    }
    catch(err)
    {
        res.status(400).json({
            ok : false , 
            error : err.message
        })
    }
})


app.post("/placeOrder" , async (req,res) => {

    let {orderItems , username , totalAmount} = req.body 
    

    let orderItemQuery = 
    "INSERT INTO `order_item` (`productId`, `itemId`, `orderId`, `sku`, `price`, `discount`, `quantity`, `createdAt`, `updatedAt`, `content`) VALUES " +
    "(?, ?, ?, 'IPHONE13BLK', ? , 00, ? , NOW(), NOW(), ?)"

    let orderQuery = 
    "INSERT INTO `order` (`userId`, `type`, `status`, `subTotal`, `itemDiscount`, `tax`, `shipping`, `total`, `promo`, `discount`, `grandTotal`, `createdAt`, `updatedAt`, `content`)"
    +
    " VALUES (?, 1, \"pending\", 100.00, 0, 0, 00, ?, null , 00, ? , NOW(), NOW(), 'Order for user with user ID ?')"

    try{
        let [ user ] = await db.query( `select id from user where username = '${username}' ` )
        let userId = user[0]['id']
        
        let result = await db.query( orderQuery , [userId , totalAmount , totalAmount , totalAmount , userId] )
        let orderID = result[0]['insertId']
        console.log("orderID : " , orderID)

        for ( let order of orderItems )
        {
            await db.query( orderItemQuery , [order.productId , order.itemId , orderID , order.price , order.quantity , order.title ] )
        }


        res.status(200).json({
            ok : true , 
            orderID
        })
    }
    catch(err)
    {
        console.log(err)
        res.status(400).json({
            ok : false , 
            message : err.message
        })
    }


})

app.post("/createProduct" , async ( req , res ) => {

    try{

        let { title ,mrp ,salePrice ,sku ,summary ,selectedBrand ,selectedSupplier ,quantity } = req.body
        let productQuery = "INSERT INTO `product` (`title`, `summary`, `type`, `createdAt`, `updatedAt`, `content`) VALUES ( ? , ? , '2' , now() , now() , 'This is content' ) "
        let [ product ] = await db.query( productQuery , [ title , summary ] )

        let newProductID = product['insertId']
        console.log( product )

        let itemQuery = "INSERT INTO `item` (`productId`, `brandId`, `supplierId`, `orderId`, `sku`, `mrp`, `discount`, `price`, `quantity`, `sold`, `available`, `defective`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`) VALUES ( ? , ? , ? , 1 , ? , ? , 0 , ? , ? , 0 , ? , 1 , 1 , 1 , now() , now() ) "

        let [item] = await db.query( itemQuery , [newProductID , selectedBrand , selectedSupplier , sku , mrp , salePrice , quantity , quantity] )
        console.log(item)
        return res.status(200).json({
            ok : true 
        })
    }
    catch(error)
    {   
        console.log(error)
        return res.status(400).json({
            ok : false ,
            error
        })
    }

})

app.post( "/login" , async ( req , res ) => {

    try{
        let { email , password } = req.body 

        let query = "select * from `user` where email = ? and passwordHash = ? " 

        let [ result ] = await db.query( query , [ email , password ] )
        
        if ( result.length === 0 )
        return res.status(404).json({
            data : {} ,
            ok : false ,
            message : "No user found"
        })

        console.log( "log in  :" ,result )

        return res.status(200).json({
            ok : true ,
            data : result[0]
        })

    }
    catch(error)
    {
        console.log(error)
        return res.status(400).json({
            error ,
            ok : false ,
            message : "Could not log in"
        })
    }

})


app.listen( PORT , ( req , res ) => {
    console.log( `Server running on PORT ${PORT} ` )
} )
