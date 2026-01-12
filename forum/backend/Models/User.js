const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    name : {
        type: String,
        required: true,
        trim: true,
        minLength: 3
    },
    email : {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password : {
        type: String,
        required: true,
        minLength: 6
    }
})

module.exports = mongoose.model('User', userSchema)