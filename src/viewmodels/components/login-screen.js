var vm = function (params) {
    let vm = this

    // observables
    vm.loginEmail = ko.observable('')
    vm.loginPwd = ko.observable('')
    vm.loginErr = ko.observable()
    vm.loading = ko.observable(false)
    vm.seen = ko.observable(true)

    // behaviors
    vm.validateCreds = () => {
        vm.loading(true)
        if (emptyFields(vm.loginEmail(), vm.loginPwd())) 
            vm.loginErr("All fields are required.")
            // send info to socket
        VM
            .socket
            .emit('logon', {
                'email': vm.loginEmail(),
                'password': vm.loginPwd()
            }, (data) => {
                if (data) {
                    console.log("Login Successful!")
                    vm.seen(false)
                    vm.start(data)
                } else 
                    vm.loginErr("Username/password incorrect!")
                console.dir(data)
            })
        console.log(`Email: ${vm.loginEmail()} Password: ${vm.loginPwd()}`)
    }
    vm.dismissLoading = () => {
        vm.loading(false)
        vm.loginErr(null)
    }
    vm.start = (data) => {
        vm.seen(false)
        VM.ROLE(data.role)
        VM.loadView('home-screen')
        console.log("Starting...")
        console.log(`Role = ${data.role}`)
    }

    // helper functions
    function emptyFields(...fields) {
        var empty = false
        fields.forEach(items => {
            if (items.trim().length === 0) 
                empty = true
        })
        return empty
    }

    // init
    if (typeof params.firstRun != 'undefined' && VM.MODE() == SERVER) {
        vm.start({role: 'ADMIN'}) // don't require logon from server-running admin on first run
    }
}

new Component('login-screen')
    .def(vm)
    .load()