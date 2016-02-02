---
title: Local Authentication with Express and Passport
type: lesson
duration: "1:30"
creator:
    name: Mike HOPPER
    city: Atlanta
competencies: Express, Mongoose, MongoDB
---

# Local Authentication with Express and Passport

## Objectives
*After this lesson, students will be able to:*

- Create a login form with email & password
- Use passport-local to find a user & verify their password
- Restrict access to certain RESTful endpoints to authenticated users

## Preparation
*Before this lesson, students should already be able to:*

- Create an express application and add CRUD/REST resources
- Create a Mongoose Model
- Describe Authentication and Authorization

## What is Passport? (5 mins)

From the [passport website](http://passportjs.org/docs):

* Passport is authentication middleware for Node.js
* Extremely flexible and modular, Passport can be unobtrusively dropped in to any Express-based web application.
* A comprehensive set of strategies support authentication using a username and password, OAuth(Facebook, Twitter), and more.

## Strategies

* The main concept when using passport is to register _Strategies_.
* A strategy is a passport Middleware that will create some action in the background and execute a callback
* The callback should be called with different arguments depending on whether the action performed in the strategy was successful or not.
* Passport will redirect the request to different paths based on the outcome of the callback.

Because strategies are packaged as individual modules, we can pick and choose which ones we need for our application.

## Implementing Passport - Codealong (25 mins)

### Outline

* [Starter Code](#starter-code)
* [Adding Passport to the Project](#adding-passport-to-the-project)
* [Configuring Our New Modules](#configuring-our-new-modules)
* [Flash Messages - Intro (5 mins)](#flash-messages---intro-(5-mins))
* [Creating a User Model](#creating-a-user-model)
* [Configuring Passport for SignUp (Registration)](#configuring-passport-for-signup-(registration))
* [Session Mgmt](#session-mgmt)
* [Configuring the SignUp Strategy](#configuring-the-signup-strategy)
* [Configuring the Login Strategy](#configuring-the-login-strategy)
* [Incorporating Flash Messages - Codealong (5 mins)](#incorporating-flash-messages---codealong-(5-mins))
* [Adding the Routes](#adding-the-routes)
* [Add the Views](#add-the-views)


### Starter Code

We will be starting with the code at [todo-passport](https://github.com/drmikeh/todos.git).

If you already have this repo, simply `cd` into that directory and make sure you have the latest code via `git pull`. Otherwise, clone this repo:

```bash
cd ~/ga/wdi/mini-projects
git clone https://github.com/drmikeh/todos.git
cd todos
```

Now create a branch:

```bash
git checkout -b passport
```

### Adding Passport to the Project

```bash
npm install --save passport
npm install --save passport-local
npm install --save bcrypt-nodejs
npm install --save connect-flash
npm install --save express-session
```

Other optional passport modules:

* passport-facebook
* passport-google-oauth
* passport-twitter

### Configuring Our New Modules

Update `app.js` to include the following code:

```javascript
.
.
.
var passport = require('passport');
var session = require('express-session');
var flash = require('connect-flash');
.
.
.
app.use(session({ secret: 'WDI Rocks!' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

require('./config/passport/passport')(passport);

// This middleware will allow us to use the currentUser in our views and routes.
app.use(function (req, res, next) {
  global.currentUser = req.user;
  next();
});
```

### Flash Messages - Intro (5 mins)

Remember Rails? Flash messages were one-time messages that were rendered in the views and when the page was reloaded, the flash was destroyed.

In the upcoming code we will define flash messages:

```javascript
  req.flash('error', 'This email is already used.')
```

This will store the message 'This email is already used.' into the response object and then we will be able to use it in the views.

This is really useful to send back details about the process happening on the server to the client.


### Creating a User Model

```bash
touch models/user.js
```

Edit `models/user.js` and add:

```javascript
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');
var Todo = require('./todo');

var User = new mongoose.Schema({
  local : {
    email    : String,
    password : String
  },
  todos : [Todo.schema]
});

User.methods.encrypt = function(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8));
};

User.methods.isValidPassword = function(password) {
  return bcrypt.compareSync(password, this.local.password);
};

module.exports = mongoose.model('User', User);
```

NOTES:

* We can add methods to a Mongoose model
* The `encrypt` method generates a _salt_ token and then hash (encrypt) the password using the salt.
* The `isValidPassword` method validates a supplied password using `bcrypt`.


### Configuring Passport for SignUp (Registration)

Create the following files:

```bash
mkdir -p config/passport
touch config/passport/passport.js
touch config/passport/local-signup-strategy.js
touch config/passport/local-login-strategy.js
```

Open the file `config/passport/passport.js` and add:

```javascript
var localSignupStrategy = require('./local-signup-strategy');
var localLoginStrategy  = require('./local-login-strategy');
var User = require('../../models/user');

var passportConfig = function(passport) {

  // Strategies
  passport.use('local-signup', localSignupStrategy);
  passport.use('local-login' , localLoginStrategy);

  // Session Support
  passport.serializeUser(function(user, callback) {
    callback(null, user.id);
  });

  passport.deserializeUser(function(id, callback) {
    User.findById(id, function(err, user) {
      callback(err, user);
    });
  });
};

module.exports = passportConfig;
```

Here we are creating a configuration for Passport. For better code organization, we are loading the _signup_ config and the _signin_ config from two separate files.

### Session Mgmt

We've seen in previous lessons that authentication is based on a value stored in a cookie, and then, this cookie is sent to the server for every request until the session expires or is destroyed.

To manage the session with passport, we added the methods `serializeUser` and `deserializeUser`.

The method `serializeUser` will be used when a user signs in or signs up, passport will call this method, and our code will call the `callback` passing in the user.id as the value that we want serialized.

The second method will then be called every time there is a value for passport in the session cookie. In this method, we will receive the value stored in the cookie (`user.id`) and we will search for a user with this ID and call the callback. The user object will then be stored in the request object passed to all router/controller methods calls.


### Configuring the SignUp Strategy

When the server receives the signup params, the passport local strategy will need to:

* verify that the email has not already been used
* save the user data into the database
* hash the password

Edit `config/passport/local-signup-strategy.js` and add:

```javascript
var LocalStrategy   = require('passport-local').Strategy;
var User            = require('../../models/user');

var strategy = new LocalStrategy({
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true
  },
  function(req, email, password, callback) {
    // Find a user with this e-mail
    User.findOne({ 'local.email' :  email }, function(err, user) {
      if (err) return callback(err);
      if (user) {
        // A user with this email already exists
        return callback(null, false, req.flash('error', 'This email is already taken.'));
      }
      else {
        // Create a new user
        var newUser            = new User();
        newUser.local.email    = email;
        newUser.local.password = newUser.encrypt(password);

        newUser.save(function(err) {
          return callback(err, newUser);
        });
      }
    });
  });

module.exports = strategy;
```

Here we are declaring the _local_ strategy for the signup, including the fields we will use for the authentication (`email` and `password`).

By default, passport-local expects to use the fields `username` and `password` in the request. If you use different field names, as we do, you can give this information to `LocalStrategy`.

The third argument is a callback that contains the custom logic to signup a user.

### Configuring the Login Strategy

When the server receives the login params, the passport local strategy will need to:

* verify that the user is in the database
* verify the password

Edit `config/passport/local-login-strategy.js` and add:

```javascript
var LocalStrategy   = require('passport-local').Strategy;
var User            = require('../../models/user');

var strategy = new LocalStrategy({
    usernameField : 'email',                 // default is 'username'
    passwordField : 'password',
    passReqToCallback : true
  }, function(req, email, password, callback) {
    // Search for a user with this email
    User.findOne({ 'local.email' : email }, function(err, user) {
      if (err) return callback(err);

      // If no user is found
      if (!user) {
        return callback(null, false, req.flash('error', 'User not found.'));
      }

      // Validate password
      if (!user.isValidPassword(password)) {
        return callback(null, false, req.flash('error', 'Oops! Wrong password.'));
      }
      return callback(null, user);
    });
  });

module.exports = strategy;
```

### Incorporating Flash Messages - Codealong (5 mins)

In the view `header.ejs` add the following beneath the navbar:

```ejs
<div class="flash">
  <% if (typeof message !== 'undefined') { %>
    <% if (typeof message.error !== 'undefined' && message.error.length > 0) { %>
      <div class="bg-danger"><%= message.error %></div>
    <% } %>
    <% if (typeof message.info !== 'undefined' && message.info.length > 0) { %>
      <div class="bg-info"><%= message.info %></div>
    <% } %>
    <% if (typeof message.success !== 'undefined' && message.success.length > 0) { %>
      <div class="bg-success"><%= message.success %></div>
    <% } %>
  <% } %>
</div>
```

## Updating the NavBar

We want to add links to the navbar for `login`, `signup`, and `logout`:

Update the navbar links in `views/partials/header.ejs` to look like the following:

```html
    <ul class="nav navbar-nav navbar-left">
      <li><a href="/">Home</a></li>
      <% if (currentUser) { %>
        <li><a href="/todos">TODOs</a></li>
      <% } %>
    </ul>
    <ul class="nav navbar-nav navbar-right">
      <% if (currentUser) { %>
        <li><a href="#"><%= currentUser.local.email %></a></li>
        <li><a href="/logout">Logout</a></li>
      <% } else { %>
        <li><a href="/login">Login</a></li>
        <li><a href="/signup">Signup</a></li>
      <% } %>
    </ul>
```

### Adding the Routes

We will need routes for _signup_, _signin_, and _logout_.

Edit `routes/index.js` and add the following routes:

```javascript
.
.
.
var passport = require('passport');
.
.
.

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express', message: req.flash() });  // add the message
});

// GET /signup
router.get('/signup', function(req, res, next) {
  res.render('signup.ejs', { message: req.flash() });
});

// POST /signup
router.post('/signup', function(req, res, next) {
  var signUpStrategy = passport.authenticate('local-signup', {
    successRedirect : '/todos',
    failureRedirect : '/signup',
    failureFlash : true
  });

  return signUpStrategy(req, res, next);
});

// GET /login
router.get('/login', function(req, res, next) {
  res.render('login.ejs', { message: req.flash() });
});

// POST /login
router.post('/login', function(req, res, next) {
  var loginProperty = passport.authenticate('local-login', {
    successRedirect : '/todos',
    failureRedirect : '/login',
    failureFlash : true
  });

  return loginProperty(req, res, next);
});

// GET /logout
router.get('/logout', function(req, res, next) {
  req.logout();
  res.redirect('/');
});

// Restricted page
router.get('/secret', function(req, res, next) {
  if (currentUser) {
    res.render('secret.ejs');
  }
  else {
    res.redirect('/');
  }
});
.
.
.
```

### Add the Views

We will need views for _signup_ and _login_ and we will also create a _secret_ page that only authenticated users can access:

```bash
touch views/signup.ejs
touch views/login.ejs
touch views/secret.ejs
```

Add the following to `views/signup.ejs`:

```html
<!doctype html>
<html lang="en">
  <head>
    <% include partials/head %>
  </head>

  <body class="container-fluid">
    <header>
      <% include partials/header %>
    </header>

    <main>
      <div>
        <h2>Signup</h2>
        <form method="post" action="/signup">
          <div class="form-group">
            <label for="email">Email</label>
            <input class="form-control" type="text" name="email" id="email">
          </div>

          <div class="form-group">
            <label for="email">Password</label>
            <input class="form-control" type="password" name="password" id="password">
          </div>

          <input class="btn btn-default" type="submit">
        </form>
      </div>
    </main>

    <footer>
      <% include partials/footer %>
    </footer>
  </body>
</html>
```

Add the following to `views/login.ejs`:

```html
<!doctype html>
<html lang="en">
  <head>
    <% include partials/head %>
  </head>

  <body class="container-fluid">
    <header>
      <% include partials/header %>
    </header>

    <main>
      <div>
        <h2>Login</h2>
          <form method="post" action="/login">
            <div class="form-group">
              <label for="email">Email</label>
              <input class="form-control" type="text" name="email" id="email">
            </div>

            <div class="form-group">
              <label for="email">Password</label>
              <input class="form-control" type="password" name="password" id="password">
            </div>

            <input class="btn btn-default" type="submit">
          </form>
      </div>
    </main>

    <footer>
      <% include partials/footer %>
    </footer>
  </body>
</html>
```

Add the following to `views/secret.ejs`:

```html
<!doctype html>
<html lang="en">
  <head>
    <% include partials/head %>
  </head>

  <body class="container-fluid">
    <header>
      <% include partials/header %>
    </header>

    <main>
      <div class="jumbotron">
        <h1>Congrats! You have reached the <span style="color: red">SECRET</span> page</h1>
      </div>
    </main>

    <footer>
      <% include partials/footer %>
    </footer>
  </body>
</html>
```


## Test It All Out

Now, start up the app using `nodemon app.js` and visit `http://localhost:3000/signup` and try the following:

1. when not logged in, try to go to the secret page - `localhost:3000/secret`
2. signup
3. logout
4. try to signup using the same email as in step 2 - you should get an error message that the email is already taken.
5. login
6. while logged in, try to go to the secret page - it should work this time
7. logout
8. while logged out, try to go to the todos page (just set your browser url to `http://localhost:3000/todos`)
9. try creating, editing, and deleting some TODOs - why does this work when you are not logged in?

We have some serious security problems with our TODOs views. We need to fix those!

## Secure the TODOs

We want to ensure 2 things:

1. Only authenticated users can get to any of the TODOs views.
2. A user can only access his/her own TODOs.

### Protecting Access to the TODOs routes

To accomplish this, we will add a helper method that will redirect if the user is not authenticated. This helper method just helps us keep our code _DRY_:

Edit `/routes/todos.js` and add the following code above the route definitions:

```javascript
var authenticate = function(req, res, next) {
  if(!req.isAuthenticated()) {
    res.redirect('/');
  }
  else {
    next();
  }
}
```

Now we can call this function from our route definitions in a special way.

### Securing the TODOs INDEX route

Edit `routes/todos.js` and change the _INDEX_ route from:

```javascript
// INDEX
router.get('/', function(req, res, next) {
   ...
});
```

to

```javascript
// INDEX
router.get('/', authenticate, function(req, res, next) {
   ...
});
```

What we have done is added a call to `authenticate` directly in our route configuration. If `authenticate` does not detect an authenticated user session, then a redirect will send the browser to the root route (the home view).

Try it out by logging out and then trying to load `localhost:3000/todos`. Does it do the redirect?

#### Displaying on the currentUser's TODOs

Now we need to only show the TODOs that belong to the current user. Edit `routes/todos.js` and change the definition of the _INDEX_ route to:

```javascript
// INDEX
router.get('/', authenticate, function(req, res, next) {
  var todos = global.currentUser.todos;
  res.render('todos/index', { todos: todos, message: req.flash() });
});
```

So this code is actually a bit simpler than what we had. We are leveraging the fact that an authenticated user session will populate a `global.currentUser` and now we just need to get the todos from the `currentUser` and pass those into the `render` function.

### Securing the TODOs NEW Route

To secure the _NEW_ route we need to just call `authenticate` and add the `flash` message support.

Edit `routes/todos.js` and change the _NEW_ route definition to:

```javascript
// NEW
router.get('/new', authenticate, function(req, res, next) {
  var todo = {
    title: '',
    completed: false
  };
  res.render('todos/new', { todo: todo, message: req.flash() });
});
```

### Securing the TODOs SHOW Route

The SHOW route still allows unauthenticated users to view the page and allows a user to see another user's TODO. To fix that, we need to add the call to the `authenticate` helper method and pull the TODO object from the `currentUser`'s list of TODOs:

Edit `routes/todos.js` and change the _SHOW_ route definition to:

```javascript
// SHOW
router.get('/:id', authenticate, function(req, res, next) {
  var todo = currentUser.todos.id(req.params.id);
  if (!todo) return next(makeError(res, 'Document not found', 404));
  res.render('todos/show', { todo: todo, message: req.flash() } );
});
```

### Securing the TODOs CREATE Route

Now that our `Todo`s are an embedded document inside the `User` model, we need to treat it as such. For embedded documents we just need to create the document in memory and then add it to the parent document and save the parent document.

Edit `routes/todos.js` and change the _CREATE_ route definition to:

```javascript
// CREATE
router.post('/', authenticate, function(req, res, next) {
  var todo = {
    title: req.body.title,
    completed: req.body.completed ? true : false
  };
  // Since a user's todos are an embedded document, we just need to push a new
  // TODO to the user's list of todos and save the user.
  currentUser.todos.push(todo);
  currentUser.save()
  .then(function() {
    res.redirect('/todos');
  }, function(err) {
    return next(err);
  });
});
```

### Securing the TODOs EDIT Route

For the _EDIT_ route we want to add the call to `authenticate` and also return an edit form with a TODO _only_ if the TODO belongs to that user. Otherwise we return a 404 error page.

Edit `routes/todos.js` and change the _EDIT_ route definition to:

```javascript
// EDIT
router.get('/:id/edit', authenticate, function(req, res, next) {
  var todo = currentUser.todos.id(req.params.id);
  if (!todo) return next(makeError(res, 'Document not found', 404));
  var checked = todo.completed ? 'checked' : '';
  res.render('todos/edit', { todo: todo, checked: checked, message: req.flash() } );
});
```

### Securing the TODOs UPDATE Route

For the _UPDATE_ route we need to add the call to `authenticate` and also ensure that the `:id` parameter in the URL is the id of a Todo that belongs to the `currentUser`. Otherwise we will return a 404 error page. We also ensure that the updated Todo is saved as an embedded document inside the `currentUser`.

Edit `routes/todos.js` and change the _UPDATE_ route definition to:

```javascript
// UPDATE
router.put('/:id', authenticate, function(req, res, next) {
  var todo = currentUser.todos.id(req.params.id);
  if (!todo) return next(makeError(res, 'Document not found', 404));
  else {
    todo.title = req.body.title;
    todo.completed = req.body.completed ? true : false;
    currentUser.save()
    .then(function(saved) {
      res.redirect('/todos');
    }, function(err) {
      return next(err);
    });
  }
});
```

### Securing the TODOs DESTROY Route

For the _DESTROY_ route we again want to add the call to `authenticate` and ensure that the `Todo` being destroyed does belong to the `currentUser`. To destroy an embedded document we simply remove it from the parent document and save the parent document. Since a `User`'s `todos` are an array, we use the `slice` method to remove the `Todo` from that array.

Edit `routes/todos.js` and change the _DESTROY_ route definition to:

```javascript
// DESTROY
router.delete('/:id', authenticate, function(req, res, next) {
  var todo = currentUser.todos.id(req.params.id);
  if (!todo) return next(makeError(res, 'Document not found', 404));
  var index = currentUser.todos.indexOf(todo);
  currentUser.todos.splice(index, 1);
  currentUser.save()
  .then(function(saved) {
    res.redirect('/todos');
  }, function(err) {
    return next(err);
  });
});
```

> Notice that when securing our TODOs routes, we never had to modify the views. We only modified the Route definitions / Controller logic.

## Test It All Out

* Try to view, create, edit, and destroy TODOs (positive testing).
* Try to view or edit a TODO that does not belong to the `currentUser` (by manipulating the browser URL)

## Conclusion (5 mins)

Passport is a really useful tool because it allows developers to abstract the logic of authentication and customize it, if needed. It comes with a lot of extensions that we will cover later.

- Briefly describe the authentication process using passport in Express.
- How do salts work with hashing?
