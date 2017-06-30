const promisifier = require('bluebird')
var exports = module.exports = {}

var Datastore = require('linvodb3')
Datastore.defaults.store = {
    db: require("level-js")
}
Datastore.dbPath = process.cwd()

// schemas defining docs (tables)
const schemas = {
    settings: {
        label: {
            type: String,
            unique: true
        },
        value: {}
    },
    admins: {
        name: String,
        email: {
            type: String,
            unique: true
        },
        password: String,
        is_first: {
            type: Boolean,
            default: false
        }
    }
}

/**
 * db map, helps to ensure we only have a single instance per doc
 */
let map = {}

/**
 * Checks if specified field, according to schema definition, has unique index
 * @param {string} dbname 
 * @param {string} field 
 */
function _isUnique(dbname, field) {
    let schema = schemas[dbname] || {}
    if (_.isEmpty(schema)) 
        return false;
    if (_.isEmpty(schema[field])) 
        return false;
    return typeof schema[field].unique != 'undefined'
}

/**
 * Export the heart of this module, the guy that instantiates docs
 */
module.exports = (...name) => {
    let dbs = []
    name.map((n) => {
        n = n.toLowerCase();
        if (typeof map[n] != 'undefined') 
            dbs.push(map[n])
        else {
            console.log(`instantiating ${n} db`)
            let schema = schemas[n] || {}
            let ds = _.isEmpty(schema)
                ? Datastore(n)
                : Datastore(n, schema, {})

            // enforce index
            if (!_.isEmpty(schema)) {
                for (let prop in schema) 
                    (typeof schema[prop].unique == 'undefined') || ds.ensureIndex({fieldName: prop, unique: true})
            }

            promisifier.promisifyAll(ds.find().__proto__)
            ds.extend({
                ___name: n,
                /**
                 * Wrapper for .insert(), to make it promise-aware
                 */
                i: function (data) {
                    return new Promise((resolve, reject) => {
                        this.insert(data, (err, doc) => (err || doc) === doc
                            ? resolve(doc)
                            : reject(err))
                    })
                },
                /**
                 * Clears all data in concerned doc
                 */
                clear: function () {
                    return new Promise((resolve, reject) => {
                        this.remove({}, {
                            multi: true
                        }, (err, num) => (err || num) === num
                            ? resolve(num)
                            : reject(err))
                    })
                },
                /**
                 * Use this for insert operations that may end up being updates
                 * Works with unique fields in the update payload
                 */
                iu: function (data) {
                    return new Promise((resolve, reject) => {
                        data = Array.isArray(data)
                            ? data
                            : [data]
                        data.forEach(function (o) {
                            let cond = []
                            for (let i in o) 
                                if (_isUnique(this.___name, i)) {
                                    let _o = {}
                                    _o[i] = o[i]
                                    cond.push(_o)
                                }
                            this.insert(o, (err, doc) => {
                                if ((err || doc) === doc) return;
                                // insert failed, try update
                                if (cond.length > 0)
                                    this.update({
                                        $or: cond
                                    }, o, {})
                            })
                        }, this)
                        resolve()
                    })
                },
                /**
                 * Wrapper for .save(), to make it promise-aware
                 */
                s: function (data) {
                    return new Promise((resolve, reject) => {
                        this.save(data, (err, doc) => (err || doc) === doc
                            ? resolve(doc)
                            : reject(err))
                    })
                }
            })
            map[n] = ds
            dbs.push(ds)
        }
    })
    return dbs
}