const DEBUG = true;
let app;

const bitbucketToGithub = axios.create({
    baseURL: 'http://127.0.0.1:8000/api',
});

const bitbucket = axios.create({
    baseURL: 'https://api.bitbucket.org/2.0',
});

function log(message) {
    if (DEBUG) {
        console.log(message);
    }
}

function clearHash() {
    if(window.history.pushState) {
        window.history.pushState('', 'Bitbucket to Github', window.location.pathname)
    } else {
        window.location.hash = '';
    }
}

function retrieveBitbucketToken() {
    // #access_token={token}&token_type=bearer
    if (window.location.hash){
        // todo some validation here and possibly remove token from url
        const token = window.location.hash.split('&')[0].substring(14);
        localStorage.setItem('bitbucketToken', token);
        clearHash();
        return token;
    } else if (localStorage.getItem('bitbucketToken')) {
        return localStorage.getItem('bitbucketToken');
    }
}

function retrieveGithubCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        urlParams.delete('code');
        return code;
    }
}

async function init(token, code) {
    app = new Vue({
        el: '#app',
        data: {
            token: token,
            code: code,
            userInfo: {},
            loginInfo: {},
            loading: false,
            repos: {},
            githubLoading: false,
        },
        computed: {
            loggedIn: function () {
                return !!this.token;
            },
        },
        watch: {

        },
        methods: {
            getUserInfo: async function () {
                this.loading = true;
                try {
                    const response = await bitbucket.get(`/user?access_token=${this.token}`);
                    this.userInfo = response.data;

                    const result = await bitbucketToGithub.post('/login/', {
                        "username": this.userInfo.username,
                        "bitbucket_token": this.token,
                    });
                    this.loginInfo = result.data;
                } catch (e) {
                    this.logout();
                } finally {
                    this.loading = false;
                }

            },
            retrieveGithubAuthToken: async function() {
                if (!this.loginInfo.githubAuthenticated) {
                    this.githubLoading = true;
                    try {
                        const response = await bitbucketToGithub.post('/authorize-github/', {code: this.code}, {headers: {'Authorization': `Bearer ${this.loginInfo.token}`}});
                        this.loginInfo.githubAuthenticated = true;
                    } catch (e) {
                        this.loginInfo.githubAuthenticated = false;
                    } finally {
                        this.githubLoading = false;
                    }
                }
            },
            getUserRepos: async function() {
                this.loading = true;
                try {
                    const response = await bitbucket.get(`/repositories/${this.userInfo.username}?access_token=${this.token}&role=owner`);
                    this.repos = response.data;
                } catch (e) {
                    // todo some kind of notification
                    if (e.response.status === 401) this.logout();
                } finally {
                    this.loading = false;
                }
            },
            logout: function () {
                localStorage.removeItem('bitbucketToken');
                this.token = undefined;
                this.userInfo= {};
                this.code = undefined;
                this.loginInfo= {};
                this.loading= false;
                this.repos = {};
                this.githubLoading= false;
            }
        }
    });
    await app.getUserInfo();
    await app.retrieveGithubAuthToken();
}

window.addEventListener("load", function(){
    const token = retrieveBitbucketToken();
    const code = retrieveGithubCode();
    init(token, code);
});
