const DEBUG = true;
let app;

const instance = axios.create({
    baseURL: 'localhost:5000/api/actions',
    timeout: 1000,
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

function retrieveToken() {
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

function init(token) {
    app = new Vue({
        el: '#app',
        data: {
            token: token,
            userInfo: {},
            loading: false,
            repos: {},
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
                } catch (e) {
                    this.logout();
                } finally {
                    this.loading = false;
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
            }
        }
    });
    app.getUserInfo();
}

window.addEventListener("load", function(){
    const token = retrieveToken();
    init(token);
});
