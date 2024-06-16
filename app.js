//carregando modulos
const express = require('express')
const { engine } = require('express-handlebars');
const bodyParser = require("body-parser")
const app = express()
const path = require("path")
const mongoose = require("mongoose")
const session = require("express-session")
const flash = require("connect-flash")
const passport = require("passport")
require("./config/auth")(passport)
require("./models/Usuario");
require("./models/Produto")
require("./models/Categoria")
require("./models/Estoque")
const Usuario = mongoose.model("usuarios");
const Produto = mongoose.model("produtos")
const Categoria = mongoose.model("categorias")
const Estoque = mongoose.model("estoques")
const db = require("./config/db")
const bcrypt = require("bcryptjs");
const {Logado} = require("./helpers/Logado")




//Configurações
//sessão
    app.use(session({
        secret: "qualquerCoisaSegura",
        resave: true,
        saveUninitialized: true
    }))
    //a ordem importa
    app.use(passport.initialize())
    app.use(passport.session())
    app.use(flash())
//Middleware
    app.use((req,res,next)=>{
        res.locals.success_msg = req.flash("success_msg")
        res.locals.error_msg = req.flash("error_msg")
        res.locals.error = req.flash("error")
        res.locals.user = req.user || null;
        next()
    })
//Bodyparser
    app.use(bodyParser.urlencoded({extended:true}))
    app.use(bodyParser.json())
//Handlebars
    app.engine('handlebars', engine({ defaultLayout: 'main' }));
    app.set('view engine', 'handlebars');
//mongoose        
    mongoose.Promise = global.Promise;
    mongoose.connect(db.mongoURI, {
    }).then(() => {
        console.log("conectado ao MongoDB Atlas");
    }).catch((err) => {
        console.log("falha na conexão ao MongoDB Atlas: " + err);
    });
//public
    app.use(express.static(path.join(__dirname, "public")))


//rotas
//app.get('/',Logado, (req, res) => {
app.get('/', (req, res) => {
    res.render('index')
});

app.get("/registro", (req, res) => {
    res.render("usuarios/registro");
});

app.post("/registro", (req, res)=>{
    var erros = []

    if(!req.body.nome || typeof req.body.nome == undefined || req.body.nome == null){
        erros.push({texto:"Nome inválido"})
    }
    if(!req.body.email || typeof req.body.email == undefined || req.body.email == null){
        erros.push({texto:"email inválido"})
    }
    if(!req.body.senha || typeof req.body.senha == undefined || req.body.senha == null){
        erros.push({texto:"senha inválida"})
    }
    if(req.body.senha.length < 4){
        erros.push({texto:"senha curta demais"})        
    }
    if(req.body.senha != req.body.senha2){        
        erros.push({texto:"senhas diferentes"})
    }
    if(erros.length > 0){
        res.render("usuarios/registro",{erros:erros})
    }else{
        Usuario.findOne({email:req.body.email}).then((usuario)=>{
            if(usuario){
                req.flash("error_msg", "ja existe uma conta com esse e-mail")
                res.redirect("/registro")    
            }else{
                const novoUsuario = new Usuario({
                    nome: req.body.nome,
                    email: req.body.email,
                    senha: req.body.senha
                })
                bcrypt.genSalt(10,(erro,salt)=>{
                    bcrypt.hash(novoUsuario.senha, salt, (erro, hash)=>{
                        if(erro){
                            req.flash("error_msg", "houve um erro no salvamento do usuario")
                            res.redirect('/')
                        }
                        novoUsuario.senha = hash
                        novoUsuario.save().then(()=>{
                            req.flash("success_msg", "Usuário salvo")
                            res.redirect('/')
                        }).catch((err)=>{
                            req.flash("error_msg", "houve um erro no salvamento do usuario")
                            res.redirect('/')
                        })
                    })
                })
            }
        }).catch((err)=>{
            req.flash("error_msg", "erro interno de achar usuario")
        })
    }
})

app.get("/login", (req, res)=>{
    res.render("usuarios/login")
})

app.post("/login", (req, res,next)=>{
    passport.authenticate("local",{
        successRedirect: "/",
        failureRedirect: "/login",
        failureFlash: true
    })(req,res,next)
})

app.get("/logout", (req, res)=>{
    req.logout((err) => {
        if (err) {
            console.error(err);
            return next(err);
        }
        req.flash("success_msg", "Deslogado");
        res.redirect("/");
    });
});

app.get('/produtos', (req, res) => {
    Produto.find().populate('categoria').sort({nome: 'desc'}).lean().then((produtos) => {
        res.render("produtos/produtos", {produtos: produtos});
    }).catch((err) => {
        req.flash("error_msg", "Houve um erro ao listar os produtos");
        res.redirect('/');
    });
});

app.get("/produtos/add", (req, res) => {
    Categoria.find().lean().then((categorias) => {
        res.render("produtos/addprodutos", { categorias: categorias });
    }).catch((err) => {
        req.flash("error_msg", "Erro ao carregar o formulário de adição de produtos");
        res.redirect("/produtos");
    });
});

app.post("/produtos/novo", (req, res)=>{
    var erros = []
    if(!req.body.nome || typeof req.body.nome == undefined ||req.body.nome == null){
        erros.push({ texto:"Nome inválido"})
    }    
    // if(!req.body.peso || typeof req.body.peso == undefined || req.body.peso == null || req.body.peso < 0 ){
    //     erros.push({ texto:"peso inválido"})
    // }
    if(req.body.nome.length <2){
        erros.push({ texto:"Nome do produto muito curto"})
    }
    if(erros.length >0){
        res.render("produtos/addprodutos",{erros: erros})
    }else{
        const novoProduto = {
            nome: req.body.nome,
            // peso: req.body.peso,
            descricao: req.body.descricao,
            categoria: req.body.categoria
        }    
        new Produto(novoProduto).save().then(()=>{
            req.flash("success_msg","produto salvo com sucesso")
            res.redirect("/produtos"); // Redirect to avoid re-submitting the form on refresh
        }).catch((err)=>{
            req.flash("error_msg","erro ao salvar produto")
            console.log("falha ao salvar produto"+ err)
            res.redirect("/");
        })
    }        
})

app.post("/produtos/edit",(req,res)=>{
    Produto.findOne({_id:req.body.id}).then((produto)=>{
        produto.nome = req.body.nome
        produto.descricao= req.body.descricao
        // produto.peso = req.body.peso
        produto.save().then(()=>{
            req.flash("success_msg", "Sucesso na edição")
            res.redirect("/produtos")
        }).catch((err)=>{
            res.flash("error_msg", "merda na edição")
            res.redirect("/produtos")
        })
    }).catch((err)=>{
        req.flash("error_msg", "erro ao editar")
        res.redirect("/produtos")
    })    
})

app.get("/produtos/edit/:id",(req,res)=>{
    Produto.findOne({_id:req.params.id}).lean().then((produto)=>{
        res.render('produtos/editprodutos', {produto:produto})
    }).catch((err)=>{
        req.flash("error_msg", "esta produto não existe")
        res.redirect("/produtos")
    })    
})

app.post("/produtos/deletar",(req,res)=>{   
    Produto.deleteOne({_id:req.body.id}).then(()=>{
        req.flash("success_msg", "deletado com sucesso")
        res.redirect("/produtos")
    }).catch((err)=>{
        req.flash("error_msg", "erro ao deletar produto")
        res.redirect("/produtos")
    })    
})

app.get('/categorias',(req, res)=>{
    Categoria.find().sort({date:'desc'}).lean().then((categorias)=>{
        res.render("categorias/categorias", {categorias: categorias})
    }).catch((err)=>{
        req.flash("error_msg", "Houve um erro ao listar as categorias")
    })    
})

app.get('/categorias/add',(req, res)=>{
    res.render("categorias/addcategorias")
})

app.post("/categorias/nova", (req, res)=>{
    var erros = []
    if(!req.body.nome || typeof req.body.nome == undefined ||req.body.nome == null){
        erros.push({ texto:"Nome inválido"})
    }    
    
    if(req.body.nome.length <2){
        erros.push({ texto:"Nome da categoria muito curto"})
    }

    if(erros.length >0){
        res.render("/addcategorias",{erros: erros})
    }else{
        const novaCategoria = {
            nome: req.body.nome
        }    
        new Categoria(novaCategoria).save().then(()=>{
            console.log("Categoria salva")
            req.flash("success_msg","categoria criada com sucesso")
            res.redirect("/categorias"); // Redirect to avoid re-submitting the form on refresh
        }).catch((err)=>{
            req.flash("error_msg","erro ao salvar categoria")
            console.log("falha ao salvar categoria"+ err)
            res.redirect("/");
        })
    }    
})


app.get('/estoques', (req, res) => {
    Estoque.find().populate('produto','usuario').sort({dataE: 'desc'}).lean().then((estoques) => {
        res.render("estoques/estoques", {estoques: estoques});
    }).catch((err) => {
        req.flash("error_msg", "Houve um erro ao listar os produtos");
        console.log(err)
        res.redirect('/');
    });
});

app.get("/estoques/add", (req, res) => {
    Produto.find().lean().then((produtos) => {
        res.render("estoques/addestoque", { produtos: produtos });
    }).catch((err) => {
        req.flash("error_msg", "Erro ao carregar o formulário de adição de estoques");
        res.redirect("/estoques");
    });
});




app.post("/estoques/novo", (req, res)=>{
    var erros = []
    //não fiz validação de dados aqui, estas comentadas são de onde eu copiei esse codigo 
    // if(!req.body.nome || typeof req.body.nome == undefined ||req.body.nome == null){
    //     erros.push({ texto:"Nome inválido"})
    // }        
    // if(req.body.nome.length <2){
    //     erros.push({ texto:"Nome do produto muito curto"})
    // }
    if(erros.length >0){
        res.render("produtos/addprodutos",{erros: erros})
    }else {
        const novaEntrada = {
            produto: req.body.produto,
            quantidade: req.body.quantidade,
            dataE: Date.now(),
            observacoes: req.body.observacoes,
            dataV: req.body.dataV,
            recebedor: req.user ? req.user._id : null // ensure user is logged in
        };    
        new Estoque(novaEntrada).save().then(() => {
            req.flash("success_msg", "entrada salva com sucesso");
            res.redirect("/estoques"); // Redirect to avoid re-submitting the form on refresh
        }).catch((err) => {
            req.flash("error_msg", "erro ao salvar entrada");
            console.log("falha ao salvar entrada"+ err);
            res.redirect("/");
        });
    }        
})

const PORT = process.env.PORT ||8089
app.listen(PORT,()=>{
    console.log("Servidor rodando na porta " + PORT);
})

///////////////




// app.post("/produtos/edit",(req,res)=>{
//     Produto.findOne({_id:req.body.id}).then((produto)=>{
//         produto.nome = req.body.nome
//         produto.descricao= req.body.descricao
//         // produto.peso = req.body.peso
//         produto.save().then(()=>{
//             req.flash("success_msg", "Sucesso na edição")
//             res.redirect("/produtos")
//         }).catch((err)=>{
//             res.flash("error_msg", "merda na edição")
//             res.redirect("/produtos")
//         })
//     }).catch((err)=>{
//         req.flash("error_msg", "erro ao editar")
//         res.redirect("/produtos")
//     })    
// })

// app.get("/produtos/edit/:id",(req,res)=>{
//     Produto.findOne({_id:req.params.id}).lean().then((produto)=>{
//         res.render('produtos/editprodutos', {produto:produto})
//     }).catch((err)=>{
//         req.flash("error_msg", "esta produto não existe")
//         res.redirect("/produtos")
//     })    
// })

// app.post("/produtos/deletar",(req,res)=>{   
//     Produto.deleteOne({_id:req.body.id}).then(()=>{
//         req.flash("success_msg", "deletado com sucesso")
//         res.redirect("/produtos")
//     }).catch((err)=>{
//         req.flash("error_msg", "erro ao deletar produto")
//         res.redirect("/produtos")
//     })    
// })
// ////////////////