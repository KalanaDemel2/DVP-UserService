/**
 * Created by a on 7/23/2016.
 */

var mongoose = require('mongoose');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var UserGroup = require('dvp-mongomodels/model/UserGroup').UserGroup;
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var User = require('dvp-mongomodels/model/User');
var regex = require('regex');

var util = require('util');



function GetUserGroups(req, res){


    logger.debug("DVP-UserService.GetUserGroups Internal method ");
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    UserGroup.find({company: company, tenant: tenant}, function(err, usergroups) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Groups Failed", false, undefined);

        }else {

            if (usergroups) {


                jsonString = messageFormatter.FormatMessage(err, "Get User Groups Successful", true, usergroups);

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "No User Groups Found", false, undefined);

            }
        }

        res.end(jsonString);
    });

}

function GetUserGroup(req, res){


    logger.debug("DVP-UserService.GetUserGroup Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    UserGroup.findOne({_id: req.params.id,company: company, tenant: tenant}, function(err, usergroup) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Group Failed", false, undefined);

        }else{

            if(usergroup) {
                var userObj;
                jsonString = messageFormatter.FormatMessage(err, "Get User Group Successful", true, usergroup);

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "No Get User Group found", false, undefined);

            }

        }

        res.end(jsonString);
    });

}

function DeleteUserGroup(req,res){


    logger.debug("DVP-UserService.DeleteUserGroup Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    UserGroup.findOneAndRemove({_id: req.params.id,company: company, tenant: tenant}, function(err, usergroup) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Delete User Group Failed", false, undefined);
        }else{
            jsonString = messageFormatter.FormatMessage(undefined, "User Group Deleted Successfully", true, usergroup);
        }
        res.end(jsonString);
    });
}

function CreateUserGroup(req, res) {

    logger.debug("DVP-UserService.CreateUserGroup Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);

    if(req.body && req.body.name ) {
        var userGroup = UserGroup({
            name: req.body.name,
            company: parseInt(req.user.company),
            tenant: parseInt(req.user.tenant),
            created_at: Date.now(),
            updated_at: Date.now()
        });


        userGroup.save(function (err, usergroup) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "User Group save failed", false, undefined);
                res.end(jsonString);
            } else {


                jsonString = messageFormatter.FormatMessage(undefined, "User Group saved successfully", true, usergroup);
                res.end(jsonString);
            }
        });
    }else{


        jsonString = messageFormatter.FormatMessage(undefined, "Require fields not found", false, undefined);
        res.end(jsonString);

    }
}

function UpdateUserGroup(req, res){


    logger.debug("DVP-UserService.UpdateUserGroup Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    UserGroup.findOneAndUpdate({_id: req.params.id,company: company, tenant: tenant}, req.body, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User Groups Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Update User Groups Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function UpdateUserGroupMembers(req, res) {

    logger.debug("DVP-UserService.UpdateUserGroupMembers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();


    User.findOne({_id: req.params.user,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{

            if(users) {
                UserGroup.findOneAndUpdate({_id: req.params.id,company: company, tenant: tenant}, { $addToSet :{users : req.params.user}}, function (err, users) {
                    if (err) {

                        jsonString = messageFormatter.FormatMessage(err, "Update User Group Member Failed", false, undefined);

                    } else {

                        jsonString = messageFormatter.FormatMessage(undefined, "Update User Group Member Successful", true, undefined);

                    }

                    res.end(jsonString);
                });

            }else {


                jsonString = messageFormatter.FormatMessage(err, "Get User Failed", true, undefined);
                res.end(jsonString);
            }

        }


    });



}

function RemoveUserGroupMembers(req, res){

    logger.debug("DVP-UserService.RemoveUserGroupMembers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    UserGroup.findOneAndUpdate({_id: req.params.id,company: company, tenant: tenant},{ $pull: {users : req.params.user} }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove User Group Member Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Remove User Group Member successfully", true, undefined);

        }

        res.end(jsonString);


    });


}

function FindUserGroupsByMember(req, res) {

    logger.debug("DVP-UserService.FindUserGroupsByMember Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    UserGroup.find({company: company, tenant: tenant,'users':req.params.user }, function (err, usergroups) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Group By Member Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(undefined, "Get User Group By Member Successful", true, usergroups);

        }

        res.end(jsonString);
    });

}

module.exports.GetUserGroups = GetUserGroups;
module.exports.GetUserGroup = GetUserGroup;
module.exports.DeleteUserGroup = DeleteUserGroup;
module.exports.CreateUserGroup = CreateUserGroup;
module.exports.UpdateUserGroup = UpdateUserGroup;
module.exports.UpdateUserGroupMembers = UpdateUserGroupMembers;
module.exports.RemoveUserGroupMembers = RemoveUserGroupMembers;
module.exports.FindUserGroupsByMember = FindUserGroupsByMember;




