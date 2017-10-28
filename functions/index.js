const functions = require('firebase-functions');
const admin = require('firebase-admin')
const EMAIL_SUFFIX = "@clsroom.com"
const EMAIL_SENT = "Email Sent"
const INVALID_EMAIL = "Invalid Email"
const PASSWORD_NOT_RESET = "Password not reset"
const EMAIL_NOT_SENT = "Email Not Sent"
const UID = "uid"
admin.initializeApp(functions.config().firebase)

const nodemailer = require('nodemailer');
const dbRef = admin.database().ref()
const transporter = nodemailer.createTransport({
	host: 'smtp.gmail.com',
	port: 465,
	secure: true,
	auth: {
		user: 'saleemkhan08@gmail.com',
		pass: 'third.o5'
	}
});

exports.createStaff = functions.database.ref('/staff/{userId}').onCreate( event => {
	const currentUser = event.data.val()
	if (currentUser.password) {
		return
	}
	currentUser.password = Math.random().toString(36).slice(-8)
	var email = currentUser.userId + EMAIL_SUFFIX
	console.log("email :", email);

	
	admin.auth().createUser({
		uid : currentUser.userId,
		email : email,
		password : currentUser.password,
		displayName : currentUser.fullName,
		disabled : false
	}).then(function(userRecord) {
		
		console.log("Successfully created new user:", userRecord.uid);
	}).catch(function(error) {
		console.log("Error creating new user:", error);
	});
	return event.data.ref.set(currentUser)
})

exports.createStudent = functions.database.ref('/students/{classId}/{userId}').onCreate( event => {
	const currentUser = event.data.val()

	if (currentUser.password) {
		return
	}
	currentUser.password = Math.random().toString(36).slice(-8)
	
	var email = currentUser.userId + EMAIL_SUFFIX
	admin.auth().createUser({
		uid : currentUser.userId,
		email : email,
		password : currentUser.password,
		displayName : currentUser.fullName,
		disabled : false
	}).then(function(userRecord) {
			console.log("Successfully created new user:", userRecord.uid);
		}).catch(function(error) {
		console.log("Error creating new user:", error);
	});

	return event.data.ref.set(currentUser)
})

exports.deleteStudent = functions.database.ref('/students/{classId}/{userId}').onDelete( event => {
	const currentUser = event.data.previous.val()
	admin.auth().getUserByEmail(currentUser.userId + EMAIL_SUFFIX).then(function(userRecord) {
		console.log("Successfully fetched user data:", userRecord.toJSON());
		admin.auth().deleteUser(userRecord.uid).then(function() {
			console.log("Successfully deleted user", userRecord.uid);
		}).catch(function(error) {
			console.log("Error deleting user:", error);
		});

	}).catch(function(error) {
		console.log("Error fetching user data:", error);
	});
	return
})

exports.deleteStaff = functions.database.ref('/staff/{userId}').onDelete( event => {
	const currentUser = event.data.previous.val()
	admin.auth().getUserByEmail(currentUser.userId + EMAIL_SUFFIX).then(function(userRecord) {
		console.log("Successfully fetched user data:", userRecord.toJSON());
		admin.auth().deleteUser(userRecord.uid).then(function() {
			console.log("Successfully deleted user", userRecord.uid);
		}).catch(function(error) {
			console.log("Error deleting user:", error);
		});

	}).catch(function(error) {
		console.log("Error fetching user data:", error);
	});
	return
})

exports.passwordResetHttp = functions.https.onRequest((req, res) => {
	var userRef
	const userId = req.param(UID)
	const classId = userId.substring(0,3)
	const isStaff = (userId.substring(0,1) == 'a' || userId.substring(0,1) == 's')
	
	if(isStaff){
		userRef = dbRef.child('staff').child(userId)
	}else{
		userRef = dbRef.child('students').child(classId).child(userId)
	}
	
	userRef.once('value').then(snap => {
		const currentUser = snap.val();
		const uidEmail = currentUser.userId+EMAIL_SUFFIX
		if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(currentUser.email))  
		{  
			currentUser.password = Math.random().toString(36).slice(-8)
			admin.auth().getUserByEmail(uidEmail).then(function(userRecord){
				admin.auth().updateUser(userRecord.uid, {
					password : currentUser.password
				}).then(function(userRecord) {		
					let HelperOptions = {
						from: '"Classroom" <saleemkhan08@gmail.com>',
						to: currentUser.email,
						subject: 'Password Reset',
						text: 'Hi '+ currentUser.fullName+ ', your password has been reset to : "' 
							+ currentUser.password +'". You can change your password from your profile settings once you login.'
					};
					transporter.sendMail(HelperOptions, (error, info) => {
						if (error) {
							res.send(EMAIL_NOT_SENT)
							return console.log(error);
						}
						res.send(EMAIL_SENT)
						return userRef.set(currentUser)
					});
				}).catch(function(error) {
					res.send(PASSWORD_NOT_RESET)
					
				});
			})
		}else{
			res.send(INVALID_EMAIL)
		}
	})
})

exports.staffPasswordChange = functions.database.ref('/staff/{userId}').onWrite(event => {
	const currentUser = event.data.val()
	const uidEmail = currentUser.userId+EMAIL_SUFFIX
	admin.auth().getUserByEmail(uidEmail).then(function(userRecord){
		admin.auth().updateUser(userRecord.uid, {
			password : currentUser.password
		}).then(function(userRecord) {
			// See the UserRecord reference doc for the contents of userRecord.
			console.log("Successfully updated user", userRecord.toJSON());
		}).catch(function(error) {
			console.log("Error updating user:", error);
		});
	})
})

exports.studentPasswordChange = functions.database.ref('/students/{classId}/{userId}').onWrite(event => {
	const currentUser = event.data.val()
	const uidEmail = currentUser.userId+EMAIL_SUFFIX
	admin.auth().getUserByEmail(uidEmail).then(function(userRecord){
		admin.auth().updateUser(userRecord.uid, {
			password : currentUser.password
		}).then(function(userRecord) {
			// See the UserRecord reference doc for the contents of userRecord.
			console.log("Successfully updated user", userRecord.toJSON());
		}).catch(function(error) {
			console.log("Error updating user:", error);
		});
	})
})


exports.sendNotification = functions.database.ref('/notifications/{userId}/{notificationId}').onWrite(event => {
	//Notification added in database
	const notification = event.data.val()
	const userId = event.params.userId
	const notificationId = event.params.notificationId
	
	console.log("notification: ", notification);
	console.log("userId: ", userId);
	console.log("notificationId: ", notificationId);
	
	//Creating receiver dbReference
	var receiverRef
	const receiverClassId = userId.substring(0,3)
	const isReceiverStaff = (userId.substring(0,1) == 'a' || userId.substring(0,1) == 's')
	if(isReceiverStaff){
		receiverRef = dbRef.child('staff').child(userId)
	}else{
		receiverRef = dbRef.child('students').child(receiverClassId).child(userId)
	}
	
	const payload ={
		data:{
			senderName : notification.senderName + "",
			senderPhotoUrl : notification.senderPhotoUrl + "",
			message : notification.message + "",
			senderId : notification.senderId + "",
			dateTime : notification.dateTime + "",
			leaveId : notification.leaveId + "",
			notesId : notification.notesId + "",
			leaveRefType : notification.leaveRefType + ""
		}
	}
	console.log("payload: ", payload);
	
	//Extracting receiver token
	receiverRef.once('value').then(snap => {
		const receiver = snap.val();
		console.log("receiver.token: ", receiver.token);
		admin.messaging().sendToDevice(receiver.token, payload).then(function(response) {
			console.log("Notification Sent", response);
		}).catch(function(error) {
			console.log("Error sending notification:", error);
		});
	})
})