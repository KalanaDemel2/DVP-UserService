var mongoose = require('mongoose');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var User = require('dvp-mongomodels/model/User');
var Org = require('dvp-mongomodels/model/Organisation');
var VPackage = require('dvp-mongomodels/model/Package');
var Console = require('dvp-mongomodels/model/Console');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var PublishToQueue = require('./Worker').PublishToQueue;
var util = require('util');
var crypto = require('crypto');
var config = require('config');
var redis = require('redis');

var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redisuser = config.Redis.user;
var redispass = config.Redis.password;

//[redis:]//[user][:password@][host][:port][/db-number][?db=db-number[&password=bar[&option=value]]]
//redis://user:secret@localhost:6379
var redisClient = redis.createClient(redisport, redisip);
redisClient.on('error', function (err) {
    console.log('Error '.red, err);
});

redisClient.auth(redispass, function (error) {
    console.log("Error Redis : " + error);
});


function GetUsers(req, res){


    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;



    User.find({company: company, tenant: tenant, systemuser: true})
        .select("-password")
        .exec( function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);

        }else {

            if (users) {

                jsonString = messageFormatter.FormatMessage(err, "Get Users Successful", true, users);

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get Users Failed", false, undefined);

            }
        }

        res.end(jsonString);
    });

}

function GetExternalUsers(req, res){


    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.find({company: company, tenant: tenant, systemuser: false})
        .select("-password")
        .exec( function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);

        }else {

            if (users) {


                jsonString = messageFormatter.FormatMessage(err, "Get Users Successful", true, users);

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get Users Failed", false, undefined);

            }
        }

        res.end(jsonString);
    });

}

function GetUser(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    var query = {username: req.params.name,company: company, tenant: tenant};

    User.findOne(query)
        .select("-password")
        .exec( function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

        }

        res.end(jsonString);
    });








}

function GetUsersByIDs(req, res){


    logger.debug("DVP-UserService.GetUsersByID Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    var query = {_id: {$in:req.query.id},company: company, tenant: tenant};

    if(!util.isArray(req.query.id))
        query = {_id: req.query.id,company: company, tenant: tenant};



    User.findOne(query).select("-password")
        .exec(  function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{


            jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

        }

        res.end(jsonString);
    });

}

function UserExsists(req, res){


    logger.debug("DVP-UserService.UserExsists Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{

            var userObj = false;
           if(users)
           {
               userObj = true;

           }


            jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, userObj);

        }

        res.end(jsonString);
    });








}

function OwnerExsists(req, res){


    logger.debug("DVP-UserService.OwnerExsists Internal method ");


    var jsonString;
    User.findOne({username: req.params.name}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get Owner Failed", false, undefined);

        }else{

            var userObj = false;
            if(users)
            {
                userObj = true;

            }


            jsonString = messageFormatter.FormatMessage(err, "Get Owner Successful", true, userObj);

        }

        res.end(jsonString);
    });

}

function DeleteUser(req,res){


    logger.debug("DVP-UserService.DeleteUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
            console.log(jsonString);
        } else {

            if(org.ownerId == req.params.name){

                jsonString = messageFormatter.FormatMessage(undefined, "Delete organization owner failed", false, undefined);
                console.log(jsonString);

            }else {

                User.findOneAndRemove({
                    username: req.params.name,
                    company: company,
                    tenant: tenant
                }, function (err, user) {
                    if (err) {
                        jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);
                    } else {
                        Org.findOne({tenant: tenant, id: company}, function (err, org) {
                            if (err) {
                                jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
                                console.log(jsonString);
                            } else {
                                var limitObj = FilterObjFromArray(org.consoleAccessLimits, "accessType", user.user_meta.role);
                                if (limitObj) {
                                    var userIndex = limitObj.currentAccess.indexOf(user.username);
                                    if (userIndex > -1) {
                                        limitObj.currentAccess.splice(userIndex, 1);
                                        Org.findOneAndUpdate({id: company, tenant: tenant}, org, function (err, rOrg) {
                                            if (err) {
                                                jsonString = messageFormatter.FormatMessage(err, "Update Console Access Limit Failed", false, undefined);
                                                console.log(jsonString);
                                            } else {
                                                jsonString = messageFormatter.FormatMessage(err, "Update Console Access Limit Success", true, undefined);
                                                console.log(jsonString);
                                            }
                                        });
                                    }
                                } else {
                                    console.log("Failed to update currentAccess, Cannot find Org accessType");
                                }
                            }
                        });
                        jsonString = messageFormatter.FormatMessage(undefined, "Delete User Success", true, undefined);
                    }
                    res.end(jsonString);
                });
            }
        }
    });

}

function CreateUser(req, res){

    logger.debug("DVP-UserService.CreateUser Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{
            if(org){
                if(req.body.role && req.body.mail){
                    var userRole = req.body.role.toLowerCase();
                    var limitObj = FilterObjFromArray(org.consoleAccessLimits, "accessType", userRole);
                    if(limitObj){
                        if(limitObj.accessLimit > limitObj.currentAccess.length){

                            if(!req.body.address)
                            {
                                req.body.address = {};
                            }


                            var user = User({
                                systemuser: true,
                                title: req.body.title,
                                name: req.body.name,
                                avatar: req.body.avatar,
                                birthday: req.body.birthday,
                                gender: req.body.gender,
                                firstname: req.body.firstname,
                                lastname: req.body.lastname,
                                locale: req.body.locale,
                                ssn: req.body.ssn,
                                address:{
                                    zipcode: req.body.address.zipcode,
                                    number: req.body.address.number,
                                    street: req.body.address.street,
                                    city: req.body.address.city,
                                    province: req.body.address.province,
                                    country: req.body.address.country,


                                },
                                username: req.body.mail,
                                password: req.body.password,
                                phoneNumber: {contact:req.body.phone, type: "phone", verified: false},
                                email:{contact:req.body.mail, type: "phone", verified: false},
                                company: parseInt(req.user.company),
                                tenant: parseInt(req.user.tenant),
                                user_meta: {role: userRole},
                                created_at: Date.now(),
                                updated_at: Date.now()
                            });

                            if(config.auth.login_verification){

                                user.verified = false;

                            }else{

                                user.verified = true;
                            }



                            user.save(function(err, user) {
                                if (err) {
                                    jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);
                                    res.end(jsonString);
                                }else{
                                    /*Org.findOneAndUpdate({company: company, tenant: tenant},{$filter: {input: "$consoleAccessLimits", as: "consoleAccessLimit", cond: { $eq: [ "$$consoleAccessLimit.accessType", userRole] }}, $addToSet :{$consoleAccessLimit : user.username}}, function(err, rUsers) {
                                        if (err) {
                                            user.remove(function (err) {});
                                            jsonString = messageFormatter.FormatMessage(err, "Update Limit Failed, Rollback User Creation", false, undefined);
                                        }else{
                                            jsonString = messageFormatter.FormatMessage(undefined, "User saved successfully", true, user);
                                        }
                                        res.end(jsonString);
                                    });*/

                                    limitObj.currentAccess.push(user.username);
                                    Org.findOneAndUpdate({id: company, tenant: tenant},org, function(err, rOrg) {
                                        if (err) {
                                            user.remove(function (err) {});
                                            jsonString = messageFormatter.FormatMessage(err, "Update Limit Failed, Rollback User Creation", false, undefined);
                                        }else{

                                            if(config.auth.login_verification){

                                                crypto.randomBytes(20, function (err, buf) {
                                                    var token = buf.toString('hex');

                                                    var url = config.auth.ui_host + '#/activate/' + token;

                                                    redisClient.set("activate"+":"+token,user._id ,function (err, val) {
                                                        if (err) {

                                                            jsonString = messageFormatter.FormatMessage(err, "Create activation token failed", false, user);
                                                            res.end(jsonString);

                                                        }else{


                                                            redisClient.expireat("activate"+":"+token,  parseInt((+new Date)/1000) + 86400);

                                                            var sendObj = {
                                                                "company": 0,
                                                                "tenant": 1
                                                            };

                                                            sendObj.to =  req.body.mail;
                                                            sendObj.from = "no-reply";
                                                            sendObj.template = "By-User Registration Confirmation";
                                                            sendObj.Parameters = {username: user.username,
                                                                created_at: new Date(),
                                                                url:url}

                                                            PublishToQueue("EMAILOUT", sendObj)

                                                            jsonString = messageFormatter.FormatMessage(err, "Create Account successful", true, user);
                                                            res.end(jsonString);
                                                        }
                                                    });

                                                });
                                            }else{

                                                jsonString = messageFormatter.FormatMessage(err, "Create Account successful", true, user);
                                                res.end(jsonString);
                                            }

                                        }

                                    });
                                }
                            });
                        }else{
                            jsonString = messageFormatter.FormatMessage(err, "User Limit Exceeded", false, undefined);
                            res.end(jsonString);
                        }
                    }else{
                        jsonString = messageFormatter.FormatMessage(err, "Invalid User Role", false, undefined);
                        res.end(jsonString);
                    }
                }else{
                    jsonString = messageFormatter.FormatMessage(err, "No User Role Found", false, undefined);
                    res.end(jsonString);
                }
            }else{
                jsonString = messageFormatter.FormatMessage(err, "Organisation Data NotFound", false, undefined);
                res.end(jsonString);
            }
        }
    });
}

function CreateExternalUser(req, res) {

    logger.debug("DVP-UserService.CreateUser Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);

    if(req.body) {

        if (!req.body.address) {
            req.body.address = {};
        }


        var user = User({
            systemuser: false,
            name: req.body.name,
            avatar: req.body.avatar,
            birthday: req.body.birthday,
            gender: req.body.gender,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            locale: req.body.locale,
            ssn: req.body.ssn,
            address: {
                zipcode: req.body.address.zipcode,
                number: req.body.address.number,
                street: req.body.address.street,
                city: req.body.address.city,
                province: req.body.address.province,
                country: req.body.address.country,
            },
            username: req.body.username,
            phoneNumber: {contact: req.body.phone, type: "phone", verified: false},
            email: {contact: req.body.mail, type: "phone", verified: false},
            company: parseInt(req.user.company),
            tenant: parseInt(req.user.tenant),
            created_at: Date.now(),
            updated_at: Date.now()
        });


        user.save(function (err, user) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);

            } else {
                jsonString = messageFormatter.FormatMessage(undefined, "User saved successfully", true, user);
            }
            res.end(jsonString);
        });
    }else{

        jsonString = messageFormatter.FormatMessage(undefined, "Requestbody empty", false, undefined);
        res.end(jsonString);


    }
}

function UpdateUser(req, res){



    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();

    if(req.params.name) {

        User.findOneAndUpdate({
            username: req.params.name,
            company: company,
            tenant: tenant
        }, req.body, function (err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Update User Failed", false, undefined);

            } else {

                jsonString = messageFormatter.FormatMessage(err, "Update User Successful", true, undefined);

            }

            res.end(jsonString);
        });
    }else{

        jsonString = messageFormatter.FormatMessage(err, "Update User Failed Username empty", false, undefined);
        res.end(jsonString);

    }

}

function GetMyrProfile(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    try {
        User.findOne({username: req.user.iss, company: company, tenant: tenant}).select("-password")
            .exec(function (err, users) {
                if (err) {

                    jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

                } else {

                    jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

                }

                res.end(jsonString);
            });
    }catch(ex){

        console.log(ex);
    }


}

function UpdateMyUser(req, res){



    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var userName = req.user.iss;
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: userName,company: company, tenant: tenant}, req.body, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Update User Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function GetUserProfileByResourceId(req, res){


    logger.debug("DVP-UserService.GetUserProfileByResourceId Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);

    var jsonString;



    User.findOne({resourceid: req.params.resourceid ,company: company, tenant: tenant}).select("-password")
        .exec(   function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{


            jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

        }

        res.end(jsonString);
    });


}

function GetUserProfileByContact(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var category = req.params.category;
    var contact = req.params.contact;
    var jsonString;

    var queryObject = {company: company, tenant: tenant};
    queryObject[category+".contact"] = contact
    User.find(queryObject).select("-password")
        .exec(   function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

        }

        res.end(jsonString);
    });


}

function GetExternalUserProfile(req, res){


    logger.debug("DVP-UserService.GetExternalUserProfile Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}).select("-password")
        .exec(   function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External User Failed", false, undefined);

        }else{


            jsonString = messageFormatter.FormatMessage(undefined, "Get External User Successful", true, users);

        }

        res.end(jsonString);
    });


}

function GetUserProfile(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}).select("-password")
        .exec(  function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{


            jsonString = messageFormatter.FormatMessage(undefined, "Get User Successful", true, users);

        }

        res.end(jsonString);
    });


}

function UpdateUserProfile(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    if (req.body.name) {

        delete req.body.name;
    }

    if (req.body.password) {

        delete req.body.password;

    }

    if (req.body.company) {

        delete req.body.company;

    }


    if (req.body.contacts) {

        delete req.body.contacts;

    }


    if (req.body.user_meta) {

        delete req.body.user_meta;

    }

    if (req.body.app_meta) {

        delete req.body.app_meta;

    }


    if (req.body.user_scopes) {

        delete req.body.user_scopes;

    }


    if (req.body.client_scopes) {

        delete req.body.client_scopes;

    }


    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, req.body, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function UpdateMyUserProfile(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var userName = req.user.iss;
    var jsonString;


    if (req.body.name) {

        delete req.body.name;
    }

    if (req.body.password) {

        delete req.body.password;

    }

    if (req.body.company) {

        delete req.body.company;

    }


    if (req.body.contacts) {

        delete req.body.contacts;

    }


    if (req.body.user_meta) {

        delete req.body.user_meta;

    }

    if (req.body.app_meta) {

        delete req.body.app_meta;

    }


    if (req.body.user_scopes) {

        delete req.body.user_scopes;

    }


    if (req.body.client_scopes) {

        delete req.body.client_scopes;

    }


    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: userName, company: company, tenant: tenant}, req.body, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function GetMyARDSFriendlyContactObject(req,res){


    logger.debug("DVP-UserService.GetARDSFriendlyContactObject Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var username = req.user.iss;
    var contact = req.params.contact;
    var jsonString;
    User.findOne({username: username,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{



            var contactObj = {};

            /*

             {"ContactName": "bob","Domain": "159.203.160.47","Extention":2002,"ContactType": "PRIVATE"}


             var contactSchema = new Schema({
             contact:String,
             type:String,
             display: String,
             verified: Boolean
             }, {_id: false});



             */


            ////////////////////////////////////////////
            if(users && users.contacts) {


                var contactinfo = users[contact];

                contactObj.Profile = users.username;

                if(!contactinfo){


                    contactinfo = users.contacts.filter(function (item) {
                        return item.contact == contact;
                    });



                }


                if(contactinfo && contactinfo.contact){




                    var infoArr = contactinfo.contact.split("@");
                    if(infoArr.length > 1){

                        contactObj.ContactName = infoArr[0];
                        contactObj.Domain =  infoArr[1];
                    }else{

                        contactObj.ContactName = contactinfo.contact;
                    }


                    if(contactinfo.display) {
                        contactObj.Extention = contactinfo.display;
                    }else{

                        contactObj.Extention = contactObj.ContactName;


                    }


                    contactObj.ContactType = "PUBLIC";


                    if(contact == "veeryaccount")
                        contactObj.ContactType = "PRIVATE";

                }


            }

            ///////////////////////////////////////////

            jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, contactObj);

        }

        res.end(jsonString);
    });


}

function GetARDSFriendlyContactObject(req,res){


    logger.debug("DVP-UserService.GetARDSFriendlyContactObject Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var contact = req.params.contact;
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{



            var contactObj = {};

            /*

             {"ContactName": "bob","Domain": "159.203.160.47","Extention":2002,"ContactType": "PRIVATE"}


             var contactSchema = new Schema({
             contact:String,
             type:String,
             display: String,
             verified: Boolean
             }, {_id: false});



             */


            ////////////////////////////////////////////
            if(users && users.contacts) {


                var contactinfo = users[contact];

                contactObj.Profile = users.username;

                if(!contactinfo){


                    contactinfo = users.contacts.filter(function (item) {
                        return item.contact == contact;
                    });



                }


                if(contactinfo && contactinfo.contact){




                    var infoArr = contactinfo.contact.split("@");
                    if(infoArr.length > 1){

                        contactObj.ContactName = infoArr[0];
                        contactObj.Domain =  infoArr[1];
                    }else{

                        contactObj.ContactName = contactinfo.contact;
                    }


                    if(contactinfo.display) {
                        contactObj.Extention = contactinfo.display;
                    }else{

                        contactObj.Extention = contactObj.ContactName;


                    }


                    contactObj.ContactType = "PUBLIC";


                    if(contact == "veeryaccount")
                        contactObj.ContactType = "PRIVATE";

                }


            }

            ///////////////////////////////////////////

            jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, contactObj);

        }

        res.end(jsonString);
    });


}

function UpdateUserProfileEmail(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { email : {contact:req.params.email, type:"email", verified: false}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User email Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User email Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function UpdateUserProfileContact(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { $addToSet :{contacts : {contact:req.params.contact, type:req.body.type, verified: false}}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Successful", true, users);

        }

        res.end(jsonString);
    });

}

function RemoveMyUserProfileContact(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var userName = req.user.iss;
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: userName,company: company, tenant: tenant},{ $pull: { 'contacts': {'contact':req.params.contact} } }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove contact Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Remove contact successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function UpdateMyUserProfileContact(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var userName = req.user.iss;
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: userName,company: company, tenant: tenant}, { $addToSet :{contacts : {contact:req.params.contact, type:req.body.type, verified: false}}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Successful", true, users);

        }

        res.end(jsonString);
    });

}

function RemoveUserProfileContact(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ $pull: { 'contacts': {'contact':req.params.contact} } }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove contact Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Remove contact successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function UpdateUserProfilePhone(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { phoneNumber : {contact:req.params.email, type:"voice", verified: false}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function SetUserProfileResourceId(req, res){

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    req.body.updated_at = Date.now();
    if(req.params.name) {
        User.findOneAndUpdate({
            username: req.params.name,
            company: company,
            tenant: tenant
        }, {resourceid: req.params.resourceid}, function (err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Update User resource id Failed", false, undefined);

            } else {
                if (users) {
                    jsonString = messageFormatter.FormatMessage(err, "Update User resource id Successful", true, undefined);
                } else {
                    jsonString = messageFormatter.FormatMessage(err, "No User Found", false, undefined);
                }
            }

            res.end(jsonString);
        });
    }else{

        jsonString = messageFormatter.FormatMessage(err, "Update User resource id Failed Username empty", false, undefined);
        res.end(jsonString);

    }

}

function FilterObjFromArray(itemArray, field, value){
    var resultObj;
    for(var i in itemArray){
        var item = itemArray[i];
        if(item[field] == value){
            resultObj = item;
            break;
        }
    }
    return resultObj;
}

function UniqueArray(array) {
    var processed = [];
    if(array && Array.isArray(array)) {
        for (var i = array.length - 1; i >= 0; i--) {
            if (array[i] != null) {
                if (processed.indexOf(array[i]) < 0) {
                    processed.push(array[i]);
                } else {
                    array.splice(i, 1);
                }
            }
        }
        return array;
    }else{
        return [];
    }
}

function UniqueObjectArray(array, field) {
    var processed = [];
    if(array && Array.isArray(array)) {
        for (var i = array.length - 1; i >= 0; i--) {
            if (processed.indexOf(array[i][field]) < 0) {
                processed.push(array[i][field]);
            } else {
                array.splice(i, 1);
            }
        }
        return array;
    }else{
        return [];
    }
}

function AssignConsoleToUser(req,res){
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{

            Console.findOne({consoleName: req.params.consoleName}, function(err, appConsole) {
                if (err) {
                    jsonString = messageFormatter.FormatMessage(err, "Validate Console Failed", false, undefined);
                    res.end(jsonString);
                }else{
                    User.findOne({username: adminUserName, company:company, tenant: tenant}, function(err, adminUser) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
                            res.end(jsonString);
                        } else {
                            User.findOne({username: req.params.username,company: company, tenant: tenant}, function(err, assignUser) {
                                if (err) {
                                    jsonString = messageFormatter.FormatMessage(err, "Validate Assigning User Failed", false, undefined);
                                    res.end(jsonString);
                                } else {
                                    if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin"){
                                        if(appConsole.consoleUserRoles.indexOf(assignUser.user_meta.role) > -1){
                                            var consoleAccessLimitObj = FilterObjFromArray(org.consoleAccessLimits,"accessType",assignUser.user_meta.role);
                                            //if(consoleAccessLimitObj && (consoleAccessLimitObj.currentAccess.indexOf(assignUser.username) > -1 || consoleAccessLimitObj.accessLimit > consoleAccessLimitObj.currentAccess.length)){
                                            if(consoleAccessLimitObj) {
                                                var consoleScope = FilterObjFromArray(assignUser.client_scopes,"consoleName",appConsole.consoleName);
                                                if(consoleScope){
                                                    jsonString = messageFormatter.FormatMessage(err, "Console Already Added", false, undefined);
                                                    res.end(jsonString);
                                                }else{
                                                    assignUser.client_scopes.push({consoleName: appConsole.consoleName, menus: []});
                                                }


                                                User.findOneAndUpdate({
                                                    username: req.params.username,
                                                    company: company,
                                                    tenant: tenant
                                                }, assignUser, function (err, rUser) {
                                                    if (err) {
                                                        jsonString = messageFormatter.FormatMessage(err, "Assign Console Failed", false, undefined);
                                                        res.end(jsonString);
                                                    } else {
                                                        jsonString = messageFormatter.FormatMessage(undefined, "Assign Console successfull", true, undefined);


                                                        var basicscopes = [{"scope": "myNavigation", "read": true}, {"scope": "myUserProfile", "read": true}];


                                                        User.findOneAndUpdate({
                                                            username: req.params.username,
                                                            company: company,
                                                            tenant: tenant
                                                        }, {$addToSet: {user_scopes: {$each: basicscopes}}}, function (err, rUsers) {
                                                            if (err) {
                                                                jsonString = messageFormatter.FormatMessage(err, "Update user scope Failed", false, undefined);
                                                            } else {
                                                                jsonString = messageFormatter.FormatMessage(undefined, "Update user scope successfully", true, undefined);
                                                            }
                                                            res.end(jsonString);
                                                        });

                                                        //res.end(jsonString);


                                                        //consoleAccessLimitObj.currentAccess.push(assignUser.username);
                                                        //consoleAccessLimitObj.currentAccess = UniqueArray(consoleAccessLimitObj.currentAccess);
                                                        //Org.findOneAndUpdate({
                                                        //    tenant: tenant,
                                                        //    id: company
                                                        //}, org, function (err, rOrg) {
                                                        //    if (err) {
                                                        //        jsonString = messageFormatter.FormatMessage(err, "Assign Console Failed", false, undefined);
                                                        //    } else {
                                                        //        jsonString = messageFormatter.FormatMessage(undefined, "Assign Console successfully", true, undefined);
                                                        //    }
                                                        //    console.log(jsonString);
                                                        //});
                                                    }

                                                });
                                            }else{
                                                //jsonString = messageFormatter.FormatMessage(err, "Access Denied, Console Access Limit Exceeded", false, undefined);
                                                jsonString = messageFormatter.FormatMessage(err, "Access Denied, No Console Access Limit Found", false, undefined);
                                                res.end(jsonString);
                                            }
                                        }else{
                                            jsonString = messageFormatter.FormatMessage(err, "Access Denied, No user permissions", false, undefined);
                                            res.end(jsonString);
                                        }
                                    }else{
                                        jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                                        res.end(jsonString);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function RemoveConsoleFromUser(req,res){
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{

            Console.findOne({consoleName: req.params.consoleName}, function(err, appConsole) {
                if (err) {
                    jsonString = messageFormatter.FormatMessage(err, "Validate Console Failed", false, undefined);
                    res.end(jsonString);
                }else{
                    User.findOne({username: adminUserName, company:company, tenant: tenant}, function(err, adminUser) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
                            res.end(jsonString);
                        } else {
                            User.findOne({username: req.params.username,company: company, tenant: tenant}, function(err, assignUser) {
                                if (err) {
                                    jsonString = messageFormatter.FormatMessage(err, "Validate Assigning User Failed", false, undefined);
                                    res.end(jsonString);
                                } else {
                                    if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin"){
                                        if(appConsole.consoleUserRoles.indexOf(assignUser.user_meta.role) > -1){
                                            var consoleAccessLimitObj = FilterObjFromArray(org.consoleAccessLimits,"accessType",assignUser.user_meta.role);
                                            //if(consoleAccessLimitObj && (consoleAccessLimitObj.currentAccess.indexOf(assignUser.username) > -1 || consoleAccessLimitObj.accessLimit > consoleAccessLimitObj.currentAccess.length)){
                                            if(consoleAccessLimitObj) {
                                                var consoleScope = FilterObjFromArray(assignUser.client_scopes,"consoleName",appConsole.consoleName);
                                                if(consoleScope){
                                                    for(var i in assignUser.client_scopes) {
                                                        var cs = assignUser.client_scopes[i];
                                                        if(cs.consoleName == appConsole.consoleName) {
                                                            var index = parseInt(i);
                                                            //for(var k in cs.)
                                                            assignUser.client_scopes.splice(index, 1);
                                                            break;
                                                        }
                                                    }
                                                }else{
                                                    jsonString = messageFormatter.FormatMessage(err, "Console Not Found", false, undefined);
                                                    res.end(jsonString);
                                                }


                                                User.findOneAndUpdate({
                                                    username: req.params.username,
                                                    company: company,
                                                    tenant: tenant
                                                }, assignUser, function (err, rUser) {
                                                    if (err) {
                                                        jsonString = messageFormatter.FormatMessage(err, "Remove Console Failed", false, undefined);
                                                    } else {
                                                        jsonString = messageFormatter.FormatMessage(undefined, "Remove Console successfull", true, undefined);
                                                        //for(var j in consoleAccessLimitObj.currentAccess) {
                                                        //    var cAccess = consoleAccessLimitObj.currentAccess[j];
                                                        //    if(cAccess == assignUser.username) {
                                                        //        var index = parseInt(j);
                                                        //        consoleAccessLimitObj.currentAccess.splice(index, 1);
                                                        //        break;
                                                        //    }
                                                        //}
                                                        //Org.findOneAndUpdate({
                                                        //    tenant: tenant,
                                                        //    id: company
                                                        //}, org, function (err, rOrg) {
                                                        //    if (err) {
                                                        //        jsonString = messageFormatter.FormatMessage(err, "Remove Console Failed", false, undefined);
                                                        //    } else {
                                                        //        jsonString = messageFormatter.FormatMessage(undefined, "Remove Console successfully", true, undefined);
                                                        //    }
                                                        //    console.log(jsonString);
                                                        //});
                                                    }
                                                    res.end(jsonString);
                                                });
                                            }else{
                                                //jsonString = messageFormatter.FormatMessage(err, "Access Denied, Console Access Limit Exceeded", false, undefined);
                                                jsonString = messageFormatter.FormatMessage(err, "Access Denied, No Console Access Limit Found", false, undefined);
                                                res.end(jsonString);
                                            }
                                        }else{
                                            jsonString = messageFormatter.FormatMessage(err, "Access Denied, No user permissions", false, undefined);
                                            res.end(jsonString);
                                        }
                                    }else{
                                        jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                                        res.end(jsonString);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function AddUserScopes(req, res){
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;

    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{
            User.findOne({username: adminUserName,company: company, tenant: tenant}, function(err, adminUser) {
                if (err) {
                    jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
                    res.end(jsonString);
                } else {
                    User.findOne({username: req.params.username,company: company, tenant: tenant}, function(err, assignUser) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Validate Assigning User Failed", false, undefined);
                            res.end(jsonString);
                        } else {
                            if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin"){
                                 /*
                                       assignUser.user_scopes.push(req.body);
                                       assignUser.user_scopes = UniqueObjectArray(assignUser.user_scopes,"scope");
                                       User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},assignUser, function(err, rUsers) {
                                           if (err) {
                                               jsonString = messageFormatter.FormatMessage(err, "Update user scope Failed", false, undefined);
                                           }else{
                                               jsonString = messageFormatter.FormatMessage(undefined, "Update user scope successfully", false, undefined);
                                           }
                                           res.end(jsonString);
                                       });
                                       */
                                User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ $addToSet :{user_scopes : req.body}}, function(err, rUsers) {
                                    if (err) {
                                        jsonString = messageFormatter.FormatMessage(err, "Update user scope Failed", false, undefined);
                                    }else{
                                        jsonString = messageFormatter.FormatMessage(undefined, "Update user scope successfully", true, undefined);
                                    }
                                    res.end(jsonString);
                                });
                                //{ $addToSet :{user_scopes : req.body}}
                            }else{
                                jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                                res.end(jsonString);
                            }
                        }
                    });
                }
            });
        }
    });


    //Show.update({ "_id": showId },{ "$push": { "episodes": episodeData } },callback)





}

function RemoveUserScopes(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ "$pull": { "user_scopes": {"scope":req.params.scope} } }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update user scope Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Update user scope successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function AddUserAppScopes(req, res){
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{

            Console.findOne({consoleName: req.params.consoleName}, function(err, appConsole) {
                if (err) {
                    jsonString = messageFormatter.FormatMessage(err, "Validate Console Failed", false, undefined);
                    res.end(jsonString);
                }else{
                    User.findOne({username: adminUserName, company:company, tenant: tenant}, function(err, adminUser) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
                            res.end(jsonString);
                        } else {
                            User.findOne({username: req.params.username,company: company, tenant: tenant}, function(err, assignUser) {
                                if (err) {
                                    jsonString = messageFormatter.FormatMessage(err, "Validate Assigning User Failed", false, undefined);
                                    res.end(jsonString);
                                } else {
                                    if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin"){
                                        if(appConsole.consoleUserRoles.indexOf(assignUser.user_meta.role) > -1){
                                            var consoleAccessLimitObj = FilterObjFromArray(org.consoleAccessLimits,"accessType",assignUser.user_meta.role);
                                            //if(consoleAccessLimitObj && (consoleAccessLimitObj.currentAccess.indexOf(assignUser.username) > -1 || consoleAccessLimitObj.accessLimit > consoleAccessLimitObj.currentAccess.length)){
                                            if(consoleAccessLimitObj) {
                                                var consoleScope = FilterObjFromArray(assignUser.client_scopes,"consoleName",appConsole.consoleName);
                                                if(consoleScope){
                                                    var menuItem = FilterObjFromArray(consoleScope.menus,"menuItem",req.body.menuItem);
                                                    if(menuItem){
                                                        for(var j=0; j<menuItem.menuAction.lenth; j++){
                                                            var menuAction = FilterObjFromArray(menuItem.menuAction, "scope", menuItem.menuAction[j].scope);
                                                            if(menuAction){
                                                                menuAction.read = req.body.menuAction[j].read;
                                                                menuAction.write = req.body.menuAction[j].write;
                                                                menuAction.delete = req.body.menuAction[j].delete;
                                                            }else{
                                                                assignUser.user_scopes.push(req.body.menuAction);
                                                            }
                                                        }
                                                    }else {
                                                        consoleScope.menus.push(req.body);
                                                        consoleScope.menus = UniqueObjectArray(consoleScope.menus, "menuItem");
                                                    }
                                                }else{
                                                    assignUser.client_scopes.push({consoleName: appConsole.consoleName, menus: [req.body]});
                                                }
                                                for(var i in req.body.menuAction){
                                                    var userScope = FilterObjFromArray(assignUser.user_scopes, "scope", req.body.menuAction[i].scope);
                                                    if(userScope){
                                                        userScope.read = req.body.menuAction[i].read;
                                                        userScope.write = req.body.menuAction[i].write;
                                                        userScope.delete = req.body.menuAction[i].delete;
                                                    }else{
                                                        assignUser.user_scopes.push(req.body.menuAction[i]);
                                                    }
                                                }

                                                User.findOneAndUpdate({
                                                    username: req.params.username,
                                                    company: company,
                                                    tenant: tenant
                                                }, assignUser, function (err, rUser) {
                                                    if (err) {
                                                        jsonString = messageFormatter.FormatMessage(err, "Update client scope Failed", false, undefined);
                                                    } else {
                                                        jsonString = messageFormatter.FormatMessage(undefined, "Update client scope successfully", true, undefined);
                                                        //consoleAccessLimitObj.currentAccess.push(assignUser.username);
                                                        //consoleAccessLimitObj.currentAccess = UniqueArray(consoleAccessLimitObj.currentAccess);
                                                        //Org.findOneAndUpdate({
                                                        //    tenant: tenant,
                                                        //    id: company
                                                        //}, org, function (err, rOrg) {
                                                        //    if (err) {
                                                        //        jsonString = messageFormatter.FormatMessage(err, "Update client scope Failed", false, undefined);
                                                        //    } else {
                                                        //        jsonString = messageFormatter.FormatMessage(undefined, "Update client scope successfully", false, undefined);
                                                        //    }
                                                        //    console.log(jsonString);
                                                        //});
                                                    }
                                                    res.end(jsonString);
                                                });
                                            }else{
                                                //jsonString = messageFormatter.FormatMessage(err, "Access Denied, Console Access Limit Exceeded", false, undefined);
                                                jsonString = messageFormatter.FormatMessage(err, "Access Denied, No Console Access Limit Found", false, undefined);
                                                res.end(jsonString);
                                            }
                                        }else{
                                            jsonString = messageFormatter.FormatMessage(err, "Access Denied, No user permissions", false, undefined);
                                            res.end(jsonString);
                                        }
                                    }else{
                                        jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                                        res.end(jsonString);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function RemoveUserAppScopes(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOne({username: adminUserName, company:company, tenant: tenant}, function(err, adminUser) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
            res.end(jsonString);
        } else {
            User.findOne({
                $and: [{"client_scopes.consoleName": req.params.consoleName}, {
                    username: req.params.username,
                    company: company,
                    tenant: tenant
                }]
            }, function (err, user) {
                if(err){
                    jsonString = messageFormatter.FormatMessage(err, "Validate Assigned User Failed", false, undefined);
                    res.end(jsonString);
                }else {
                    if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin") {
                        for (var i in user.client_scopes) {
                            var cScope = user.client_scopes[i];
                            if (cScope.consoleName == req.params.consoleName) {
                                for (var j in cScope.menus) {
                                    var menu = cScope.menus[j];
                                    if (menu.menuItem == req.params.navigation) {
                                        cScope.menus.splice(j, 1);
                                        break;
                                    }
                                }
                            }
                        }
                        User.findOneAndUpdate({
                            $and: [{"client_scopes.consoleName": req.params.consoleName}, {
                                username: req.params.username,
                                company: company,
                                tenant: tenant
                            }]
                        }, user, function (err, users) {
                            if (err) {
                                jsonString = messageFormatter.FormatMessage(err, "Remove Navigation scope Failed", false, undefined);
                            } else {
                                jsonString = messageFormatter.FormatMessage(undefined, "Remove Navigation successfull", true, undefined);
                            }
                            res.end(jsonString);
                        });
                    }else {
                        jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                        res.end(jsonString);
                    }
                }
            });
        }
    });
}

function GetUserMeta(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err ) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{

            if(users) {

                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users.user_meta);
            }else{
                jsonString = messageFormatter.FormatMessage(undefined, "Get User Successful", true, undefined);

            }

        }

        res.end(jsonString);
    });








}

function GetAppMeta(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{

            if(users){

                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users.app_meta);
            }
            else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User Failed", false, undefined);
            }


        }

        res.end(jsonString);
    });








}

function UpdateUserMetadata(req, res){



    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { "user_meta" : req.body }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update user meta Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Update user meta Successful", true, undefined);

        }

        res.end(jsonString);
    });





}

function UpdateAppMetadata(req, res){



    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { "app_meta" : req.body }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update app meta Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Update app meta Successful", true, undefined);

        }

        res.end(jsonString);
    });





}

function RemoveUserMetadata(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var metakey = req.params.usermeta;
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ "user_meta" : {} }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove user meta Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Remove user meta successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function RemoveAppMetadata(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var metakey = req.params.appmeta;
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ "app_meta" : {} }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update app meta Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Update app meta successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function GetUserScopes(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User scope Failed", false, undefined);

        }else{

            if(users) {
                jsonString = messageFormatter.FormatMessage(err, "Get User scope Successful", true, users.user_scopes);
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User scope Failed", false, undefined);

            }

        }

        res.end(jsonString);
    });

}

function GetAppScopes(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User app scope Failed", false, undefined);

        }else{

            if(users) {
                jsonString = messageFormatter.FormatMessage(err, "Get User app scope Successful", true, users.client_scopes);
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User app scope Failed", false, undefined);
            }

        }

        res.end(jsonString);
    });

}

function GetMyAppScopesByConsole(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var console = req.params.console;
    var jsonString;

    ////client_scopes:{$elemMatch: {consoleName: console}}


    User.findOne({username: user,company: company, tenant: tenant, }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User app scope Failed", false, undefined);

        }else{

            if(users) {

                if(users.client_scopes) {

                    var obj = users.client_scopes.filter(function(obj, index){

                        return obj.consoleName == console;

                    });

                    if(obj) {
                        jsonString = messageFormatter.FormatMessage(err, "Get User app scope Successful", true, obj);
                    }else{

                        jsonString = messageFormatter.FormatMessage(err, "No Access found to "+ console, false, undefined);
                    }
                }
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User app scope Failed", false, undefined);
            }

        }

        res.end(jsonString);
    });

}

function GetMyAppScopesByConsoles(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var consoles = req.query.consoles.split(",");
    var jsonString;

    ////client_scopes:{$elemMatch: {consoleName: console}}


    User.findOne({username: user,company: company, tenant: tenant, }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User app scope Failed", false, undefined);

        }else{

            if(users) {

                if(users.client_scopes) {
                    var consoleObjects = [];
                    for(var i =0; i< consoles.length; i++) {
                        var obj = users.client_scopes.filter(function (obj, index) {
                            return obj.consoleName == consoles[i];
                        });
                        if(obj && obj.length>0) {
                            consoleObjects.push(obj[0]);
                        }
                    }
                    if(consoleObjects) {
                        jsonString = messageFormatter.FormatMessage(err, "Get User app scope Successful", true, consoleObjects);
                    }else{

                        jsonString = messageFormatter.FormatMessage(err, "No Access found to "+ console, false, undefined);
                    }
                }
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User app scope Failed", false, undefined);
            }

        }

        res.end(jsonString);
    });

}

function GetMyAppScopes(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var jsonString;
    User.findOne({username: user,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User app scope Failed", false, undefined);

        }else{

            if(users) {
                jsonString = messageFormatter.FormatMessage(err, "Get User app scope Successful", true, users.client_scopes);
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User app scope Failed", false, undefined);
            }

        }

        res.end(jsonString);
    });

}





module.exports.GetUser = GetUser;
module.exports.GetUsers = GetUsers;
module.exports.GetUsersByIDs = GetUsersByIDs;
module.exports.DeleteUser = DeleteUser;
module.exports.CreateUser = CreateUser;
module.exports.UpdateUser = UpdateUser;
module.exports.GetUserProfile = GetUserProfile;
module.exports.GetUserProfileByContact = GetUserProfileByContact;
module.exports.UpdateUserProfile = UpdateUserProfile;
module.exports.AddUserScopes = AddUserScopes;
module.exports.RemoveUserScopes = RemoveUserScopes;
module.exports.AddUserAppScopes = AddUserAppScopes;
module.exports.RemoveUserAppScopes =RemoveUserAppScopes;
module.exports.GetUserMeta =GetUserMeta;
module.exports.GetAppMeta =GetAppMeta;
module.exports.UpdateUserMetadata = UpdateUserMetadata;
module.exports.UpdateAppMetadata = UpdateAppMetadata;
module.exports.GetUserScopes = GetUserScopes;
module.exports.GetAppScopes = GetAppScopes;
module.exports.RemoveUserMetadata = RemoveUserMetadata;
module.exports.RemoveAppMetadata= RemoveAppMetadata;
module.exports.UpdateUserProfileEmail = UpdateUserProfileEmail;
module.exports.UpdateUserProfilePhone = UpdateUserProfilePhone;
module.exports.UpdateUserProfileContact = UpdateUserProfileContact;
module.exports.RemoveUserProfileContact = RemoveUserProfileContact;


module.exports.GetMyrProfile = GetMyrProfile;
module.exports.UpdateMyUser = UpdateMyUser;
module.exports.UpdateMyUserProfile = UpdateMyUserProfile;
module.exports.UpdateMyUserProfileContact = UpdateMyUserProfileContact;
module.exports.RemoveMyUserProfileContact =RemoveMyUserProfileContact;
module.exports.GetExternalUsers = GetExternalUsers;

module.exports.SetUserProfileResourceId = SetUserProfileResourceId;
module.exports.GetUserProfileByResourceId = GetUserProfileByResourceId;
module.exports.GetARDSFriendlyContactObject = GetARDSFriendlyContactObject;
module.exports.UserExsists = UserExsists;
module.exports.AssignConsoleToUser = AssignConsoleToUser;
module.exports.RemoveConsoleFromUser = RemoveConsoleFromUser;
module.exports.CreateExternalUser =CreateExternalUser;
module.exports.GetMyAppScopes = GetMyAppScopes;


module.exports.GetMyAppScopesByConsole = GetMyAppScopesByConsole;
module.exports.GetMyAppScopesByConsoles = GetMyAppScopesByConsoles;
module.exports.GetMyARDSFriendlyContactObject = GetMyARDSFriendlyContactObject;
module.exports.OwnerExsists = OwnerExsists;

