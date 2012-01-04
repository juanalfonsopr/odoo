/*---------------------------------------------------------
 * OpenERP Web chrome
 *---------------------------------------------------------*/
openerp.web.chrome = function(openerp) {
var QWeb = openerp.web.qweb,
    _t = openerp.web._t;

openerp.web.Notification =  openerp.web.Widget.extend(/** @lends openerp.web.Notification# */{
    template: 'Notification',
    identifier_prefix: 'notification-',

    init: function() {
        this._super.apply(this, arguments);
        openerp.notification = this;
    },

    start: function() {
        this._super.apply(this, arguments);
        this.$element.notify({
            speed: 500,
            expires: 1500
        });
    },
    notify: function(title, text) {
        this.$element.notify('create', {
            title: title,
            text: text
        });
    },
    warn: function(title, text) {
        this.$element.notify('create', 'oe_notification_alert', {
            title: title,
            text: text
        });
    }

});

openerp.web.Dialog = openerp.web.OldWidget.extend(/** @lends openerp.web.Dialog# */{
    dialog_title: "",
    identifier_prefix: 'dialog',
    /**
     * @constructs openerp.web.Dialog
     * @extends openerp.web.OldWidget
     *
     * @param parent
     * @param dialog_options
     */
    init: function (parent, dialog_options) {
        var self = this;
        this._super(parent);
        this.dialog_options = {
            modal: true,
            destroy_on_close: true,
            width: $(window).width() * (($(window).width() > 1024) ? 0.5 : 0.75),
            min_width: 0,
            max_width: '95%',
            height: 'auto',
            min_height: 0,
            max_height: '95%',
            autoOpen: false,
            position: [false, 50],
            autoResize : 'auto',
            buttons: {},
            beforeClose: function () { self.on_close(); },
            resizeStop: this.on_resized
        };
        for (var f in this) {
            if (f.substr(0, 10) == 'on_button_') {
                this.dialog_options.buttons[f.substr(10)] = this[f];
            }
        }
        if (dialog_options) {
            this.set_options(dialog_options);
        }
    },
    set_options: function(options) {
        options = options || {};
        options.width = this.get_width(options.width || this.dialog_options.width);
        options.min_width = this.get_width(options.min_width || this.dialog_options.min_width);
        options.max_width = this.get_width(options.max_width || this.dialog_options.max_width);
        options.height = this.get_height(options.height || this.dialog_options.height);
        options.min_height = this.get_height(options.min_height || this.dialog_options.min_height);
        options.max_height = this.get_height(options.max_height || this.dialog_options.max_height);

        if (options.width !== 'auto') {
            if (options.width > options.max_width) options.width = options.max_width;
            if (options.width < options.min_width) options.width = options.min_width;
        }
        if (options.height !== 'auto') {
            if (options.height > options.max_height) options.height = options.max_height;
            if (options.height < options.min_height) options.height = options.min_height;
        }
        if (!options.title && this.dialog_title) {
            options.title = this.dialog_title;
        }
        _.extend(this.dialog_options, options);
    },
    get_width: function(val) {
        return this.get_size(val.toString(), $(window.top).width());
    },
    get_height: function(val) {
        return this.get_size(val.toString(), $(window.top).height());
    },
    get_size: function(val, available_size) {
        if (val === 'auto') {
            return val;
        } else if (val.slice(-1) == "%") {
            return Math.round(available_size / 100 * parseInt(val.slice(0, -1), 10));
        } else {
            return parseInt(val, 10);
        }
    },
    start: function () {
        this.$element.dialog(this.dialog_options);
        this._super();
        return this;
    },
    open: function(dialog_options) {
        // TODO fme: bind window on resize
        if (this.template) {
            this.$element.html(this.render());
        }
        this.set_options(dialog_options);
        this.$element.dialog(this.dialog_options).dialog('open');
        return this;
    },
    close: function() {
        this.$element.dialog('close');
    },
    on_close: function() {
        if (this.dialog_options.destroy_on_close) {
            this.$element.dialog('destroy');
        }
    },
    on_resized: function() {
        if (openerp.connection.debug) {
            console.log("Dialog resized to %d x %d", this.$element.width(), this.$element.height());
        }
    },
    stop: function () {
        // Destroy widget
        this.close();
        this.$element.dialog('destroy');
        this._super();
    }
});

openerp.web.CrashManager = openerp.web.CallbackEnabled.extend({
    init: function() {
        this._super();
        openerp.connection.on_rpc_error.add(this.on_rpc_error);
    },
    on_rpc_error: function(error) {
        this.error = error;
        if (error.data.fault_code) {
            var split = ("" + error.data.fault_code).split('\n')[0].split(' -- ');
            if (split.length > 1) {
                error.type = split.shift();
                error.data.fault_code = error.data.fault_code.substr(error.type.length + 4);
            }
        }
        if (error.code === 200 && error.type) {
            this.on_managed_error(error);
        } else {
            this.on_traceback(error);
        }
    },
    on_managed_error: function(error) {
        $('<div>' + QWeb.render('CrashManagerWarning', {error: error}) + '</div>').dialog({
            title: "OpenERP " + _.str.capitalize(error.type),
            buttons: [
                {text: _t("Ok"), click: function() { $(this).dialog("close"); }}
            ]
        });
    },
    on_traceback: function(error) {
        var self = this;
        var buttons = {};
        if (openerp.connection.openerp_entreprise) {
            buttons[_t("Send OpenERP Enterprise Report")] = function() {
                $this = $(this);
                var issuename = $('#issuename').val();
                var explanation = $('#explanation').val();
                var remark = $('#remark').val();
                // Call the send method from server to send mail with details
                new openerp.web.DataSet(self, 'publisher_warranty.contract').call_and_eval('send', [error.data,explanation,remark,issuename]).then(function(result){
                    if (result === false) {
                        alert('There was a communication error.')
                    } else {
                        $this.dialog('close');
                    }
                });
            };
            buttons[_t("Dont send")] = function() {
                $(this).dialog("close");
            };
        } else {
            buttons[_t("Ok")] = function() {
                $(this).dialog("close");
            };
        }
        var dialog = new openerp.web.Dialog(this, {
            title: "OpenERP " + _.str.capitalize(this.error.type),
            autoOpen: true,
            width: '80%',
            height: '50%',
            min_width: '800px',
            min_height: '600px',
            buttons: buttons
        }).start();
        dialog.$element.html(QWeb.render('CrashManagerError', {session: openerp.connection, error: error}));
    },
});

openerp.web.Loading = openerp.web.Widget.extend(/** @lends openerp.web.Loading# */{
    template: 'Loading',
    /**
     * @constructs openerp.web.Loading
     * @extends openerp.web.Widget
     *
     * @param parent
     * @param element_id
     */
    init: function(parent) {
        this._super(parent);
        this.count = 0;
        this.blocked_ui = false;
        this.session.on_rpc_request.add_first(this.on_rpc_event, 1);
        this.session.on_rpc_response.add_last(this.on_rpc_event, -1);
    },
    on_rpc_event : function(increment) {
        var self = this;
        if (!this.count && increment === 1) {
            // Block UI after 3s
            this.long_running_timer = setTimeout(function () {
                self.blocked_ui = true;
                $.blockUI();
            }, 3000);
        }

        this.count += increment;
        if (this.count > 0) {
            //this.$element.html(QWeb.render("Loading", {}));
            this.$element.html("Loading ("+this.count+")");
            this.$element.show();
            this.widget_parent.$element.addClass('loading');
        } else {
            this.count = 0;
            clearTimeout(this.long_running_timer);
            // Don't unblock if blocked by somebody else
            if (self.blocked_ui) {
                this.blocked_ui = false;
                $.unblockUI();
            }
            this.$element.fadeOut();
            this.widget_parent.$element.removeClass('loading');
        }
    }
});

openerp.web.Database = openerp.web.Widget.extend(/** @lends openerp.web.Database# */{
    /**
     * @constructs openerp.web.Database
     * @extends openerp.web.Widget
     *
     * @param parent
     * @param element_id
     * @param option_id
     */
    init: function(parent, element_id, option_id) {
        this._super(parent, element_id);
        this.$option_id = $('#' + option_id);
        this.unblockUIFunction = $.unblockUI;
    },
    start: function() {
        this._super();
        this.$element.html(QWeb.render("Database", this));

        var self = this;
        var fetch_db = this.rpc("/web/database/get_list", {}, function(result) {
            self.db_list = result.db_list;
        });
        var fetch_langs = this.rpc("/web/session/get_lang_list", {}, function(result) {
            if (result.error) {
                self.display_error(result);
                return;
            }
            self.lang_list = result.lang_list;
        });
        $.when(fetch_db, fetch_langs).then(function () {self.do_create();});

        this.$element.find('#db-create').click(this.do_create);
        this.$element.find('#db-drop').click(this.do_drop);
        this.$element.find('#db-backup').click(this.do_backup);
        this.$element.find('#db-restore').click(this.do_restore);
        this.$element.find('#db-change-password').click(this.do_change_password);
       	this.$element.find('#back-to-login').click(function() {
            self.hide();
        });
    },
    stop: function () {
        this.hide();
        this.$option_id.empty();

        this.$element
            .find('#db-create, #db-drop, #db-backup, #db-restore, #db-change-password, #back-to-login')
                .unbind('click')
            .end()
            .empty();
        this._super();
    },
    show: function () {
        this.$element.closest(".openerp")
                .removeClass("login-mode")
                .addClass("database_block");
    },
    hide: function () {
        this.$element.closest(".openerp")
                .addClass("login-mode")
                .removeClass("database_block")
    },
    /**
     * Converts a .serializeArray() result into a dict. Does not bother folding
     * multiple identical keys into an array, last key wins.
     *
     * @param {Array} array
     */
    to_object: function (array) {
        var result = {};
        _(array).each(function (record) {
            result[record.name] = record.value;
        });
        return result;
    },
    /**
     * Waits until the new database is done creating, then unblocks the UI and
     * logs the user in as admin
     *
     * @param {Number} db_creation_id identifier for the db-creation operation, used to fetch the current installation progress
     * @param {Object} info info fields for this database creation
     * @param {String} info.db name of the database being created
     * @param {String} info.password super-admin password for the database
     */
    wait_for_newdb: function (db_creation_id, info) {
        var self = this;
        self.rpc('/web/database/progress', {
            id: db_creation_id,
            password: info.password
        }, function (result) {
            var progress = result[0];
            // I'd display a progress bar, but turns out the progress status
            // the server report kind-of blows goats: it's at 0 for ~75% of
            // the installation, then jumps to 75%, then jumps down to either
            // 0 or ~40%, then back up to 75%, then terminates. Let's keep that
            // mess hidden behind a not-very-useful but not overly weird
            // message instead.
            if (progress < 1) {
                setTimeout(function () {
                    self.wait_for_newdb(db_creation_id, info);
                }, 500);
                return;
            }

            var admin = result[1][0];
            setTimeout(function () {
                self.widget_parent.do_login(
                        info.db, admin.login, admin.password);
                self.stop();
                self.unblockUI();
            });
        });
    },
    /**
     * Blocks UI and replaces $.unblockUI by a noop to prevent third parties
     * from unblocking the UI
     */
    blockUI: function () {
        $.blockUI();
        $.unblockUI = function () {};
    },
    /**
     * Reinstates $.unblockUI so third parties can play with blockUI, and
     * unblocks the UI
     */
    unblockUI: function () {
        $.unblockUI = this.unblockUIFunction;
        $.unblockUI();
    },
    /**
     * Displays an error dialog resulting from the various RPC communications
     * failing over themselves
     *
     * @param {Object} error error description
     * @param {String} error.title title of the error dialog
     * @param {String} error.error message of the error dialog
     */
    display_error: function (error) {
        return $('<div>').dialog({
            modal: true,
            title: error.title,
            buttons: [
                {text: _t("Ok"), click: function() { $(this).dialog("close"); }}
            ]
        }).html(error.error);
    },
    do_create: function() {
        var self = this;
       	self.$option_id.html(QWeb.render("Database.CreateDB", self));
        self.$option_id.find("form[name=create_db_form]").validate({
            submitHandler: function (form) {
                var fields = $(form).serializeArray();
                self.blockUI();
                self.rpc("/web/database/create", {'fields': fields}, function(result) {
                    if (result.error) {
                        self.unblockUI();
                        self.display_error(result);
                        return;
                    }
                    self.db_list.push(self.to_object(fields)['db_name']);
                    self.db_list.sort();
                    self.widget_parent.set_db_list(self.db_list);
                    var form_obj = self.to_object(fields);
                    self.wait_for_newdb(result, {
                        password: form_obj['super_admin_pwd'],
                        db: form_obj['db_name']
                    });
                });
            }
        });
    },
    do_drop: function() {
        var self = this;
       	self.$option_id.html(QWeb.render("DropDB", self));
       	self.$option_id.find("form[name=drop_db_form]").validate({
            submitHandler: function (form) {
                var $form = $(form),
                    fields = $form.serializeArray(),
                    $db_list = $form.find('select[name=drop_db]'),
                    db = $db_list.val();

                if (!confirm("Do you really want to delete the database: " + db + " ?")) {
                    return;
                }
                self.rpc("/web/database/drop", {'fields': fields}, function(result) {
                    if (result.error) {
                        self.display_error(result);
                        return;
                    }
                    $db_list.find(':selected').remove();
                    self.db_list.splice(_.indexOf(self.db_list, db, true), 1);
                    self.widget_parent.set_db_list(self.db_list);
                    self.do_notify("Dropping database", "The database '" + db + "' has been dropped");
                });
            }
        });
    },
    do_backup: function() {
        var self = this;
       	self.$option_id
            .html(QWeb.render("BackupDB", self))
            .find("form[name=backup_db_form]").validate({
            submitHandler: function (form) {
                self.blockUI();
                self.session.get_file({
                    form: form,
                    error: function (body) {
                        var error = body.firstChild.data.split('|');
                        self.display_error({
                            title: error[0],
                            error: error[1]
                        });
                    },
                    complete: $.proxy(self, 'unblockUI')
                });
            }
        });
    },
    do_restore: function() {
        var self = this;
       	self.$option_id.html(QWeb.render("RestoreDB", self));

       	self.$option_id.find("form[name=restore_db_form]").validate({
            submitHandler: function (form) {
                self.blockUI();
                $(form).ajaxSubmit({
                    url: '/web/database/restore',
                    type: 'POST',
                    resetForm: true,
                    success: function (body) {
                        // TODO: ui manipulations
                        // note: response objects don't work, but we have the
                        // HTTP body of the response~~

                        // If empty body, everything went fine
                        if (!body) { return; }

                        if (body.indexOf('403 Forbidden') !== -1) {
                            self.display_error({
                                title: 'Access Denied',
                                error: 'Incorrect super-administrator password'
                            })
                        } else {
                            self.display_error({
                                title: 'Restore Database',
                                error: 'Could not restore the database'
                            })
                        }
                    },
                    complete: $.proxy(self, 'unblockUI')
                });
            }
        });
    },
    do_change_password: function() {
        var self = this;
       	self.$option_id.html(QWeb.render("Change_DB_Pwd", self));

        self.$option_id.find("form[name=change_pwd_form]").validate({
            messages: {
                old_pwd: "Please enter your previous password",
                new_pwd: "Please enter your new password",
                confirm_pwd: {
                    required: "Please confirm your new password",
                    equalTo: "The confirmation does not match the password"
                }
            },
            submitHandler: function (form) {
                self.rpc("/web/database/change_password", {
                    'fields': $(form).serializeArray()
                }, function(result) {
                    if (result.error) {
                        self.display_error(result);
                        return;
                    }
                    self.do_notify("Changed Password", "Password has been changed successfully");
                });
            }
        });
    }
});

openerp.web.Login =  openerp.web.Widget.extend(/** @lends openerp.web.Login# */{
    remember_credentials: true,
    
    template: "Login",
    identifier_prefix: 'oe-app-login-',
    /**
     * @constructs openerp.web.Login
     * @extends openerp.web.Widget
     *
     * @param parent
     * @param element_id
     */

    init: function(parent) {
        this._super(parent);
        this.has_local_storage = typeof(localStorage) != 'undefined';
        this.selected_db = null;
        this.selected_login = null;

        if (this.has_local_storage && this.remember_credentials) {
            this.selected_db = localStorage.getItem('last_db_login_success');
            this.selected_login = localStorage.getItem('last_login_login_success');
            if (jQuery.deparam(jQuery.param.querystring()).debug != undefined) {
                this.selected_password = localStorage.getItem('last_password_login_success');
            }
        }
    },
    start: function() {
        var self = this;
        this.database = new openerp.web.Database(
                this, "oe_database", "oe_db_options");
        this.database.start();

        this.$element.find('#oe-db-config').click(function() {
            self.database.show();
        });

        this.$element.find("form").submit(this.on_submit);

        this.rpc("/web/database/get_list", {}, function(result) {
            self.set_db_list(result.db_list);
        }, 
        function(error, event) {
            if (error.data.fault_code === 'AccessDenied') {
                event.preventDefault();
            }
        });

    },
    stop: function () {
        this.database.stop();
        this._super();
    },
    set_db_list: function (list) {
        this.$element.find("[name=db]").replaceWith(
            openerp.web.qweb.render('Login_dblist', {
                db_list: list, selected_db: this.selected_db}))
    },
    on_login_invalid: function() {
        this.$element.closest(".openerp").addClass("login-mode");
    },
    on_login_valid: function() {
        this.$element.closest(".openerp").removeClass("login-mode");
    },
    on_submit: function(ev) {
        if(ev) {
            ev.preventDefault();
        }
        var $e = this.$element;
        var db = $e.find("form [name=db]").val();
        var login = $e.find("form input[name=login]").val();
        var password = $e.find("form input[name=password]").val();

        this.do_login(db, login, password);
    },
    /**
     * Performs actual login operation, and UI-related stuff
     *
     * @param {String} db database to log in
     * @param {String} login user login
     * @param {String} password user password
     */
    do_login: function (db, login, password) {
        var self = this;
        this.session.on_session_invalid.add({
            callback: function () {
                self.$element.addClass("login_invalid");
                self.on_login_invalid();
            },
            unique: true
        });
        this.session.session_authenticate(db, login, password).then(function() {
            self.$element.removeClass("login_invalid");
            if (self.has_local_storage) {
                if(self.remember_credentials) {
                    localStorage.setItem('last_db_login_success', db);
                    localStorage.setItem('last_login_login_success', login);
                    if (jQuery.deparam(jQuery.param.querystring()).debug != undefined) {
                        localStorage.setItem('last_password_login_success', password);
                    }
                } else {
                    localStorage.setItem('last_db_login_success', '');
                    localStorage.setItem('last_login_login_success', '');
                    localStorage.setItem('last_password_login_success', '');
                }
            }
            self.on_login_valid();
        });
    },
    do_ask_login: function(continuation) {
        this.on_login_invalid();
        this.$element
            .removeClass("login_invalid");
        this.on_login_valid.add({
            position: "last",
            unique: true,
            callback: continuation || function() {}
        });
    }
});

openerp.web.Header =  openerp.web.Widget.extend(/** @lends openerp.web.Header# */{
    template: "Header",
    identifier_prefix: 'oe-app-header-',
    /**
     * @constructs openerp.web.Header
     * @extends openerp.web.Widget
     *
     * @param parent
     */
    init: function(parent) {
        this._super(parent);
        this.qs = "?" + jQuery.param.querystring();
        this.$content = $();
        this.update_promise = $.Deferred().resolve();
    },
    start: function() {
        this._super();
    },
    do_update: function () {
        var self = this;
        var fct = function() {
            self.$content.remove();
            if (!self.session.uid)
                return;
            var func = new openerp.web.Model("res.users").get_func("read");
            return func(self.session.uid, ["name", "company_id"]).pipe(function(res) {
                self.$content = $(QWeb.render("Header-content", {widget: self, user: res}));
                self.$content.appendTo(self.$element);
                self.$element.find(".logout").click(self.on_logout);
                self.$element.find("a.preferences").click(self.on_preferences);
                self.$element.find(".about").click(self.on_about);
                return self.shortcut_load();
            });
        };
        this.update_promise = this.update_promise.pipe(fct, fct);
    },
    on_about: function() {
        var self = this;
        self.rpc("/web/webclient/version_info", {}).then(function(res) {
            var $help = $(QWeb.render("About-Page", {version_info: res}));
            $help.dialog({autoOpen: true,
                modal: true, width: 960, title: _t("About")});
        });
    },
    shortcut_load :function(){
        var self = this,
            sc = self.session.shortcuts,
            shortcuts_ds = new openerp.web.DataSet(this, 'ir.ui.view_sc');
        // TODO: better way to communicate between sections.
        // sc.bindings, because jquery does not bind/trigger on arrays...
        if (!sc.binding) {
            sc.binding = {};
            $(sc.binding).bind({
                'add': function (e, attrs) {
                    shortcuts_ds.create(attrs, function (out) {
                        $('<li>', {
                            'data-shortcut-id':out.result,
                            'data-id': attrs.res_id
                        }).text(attrs.name)
                          .appendTo(self.$element.find('.oe-shortcuts ul'));
                        attrs.id = out.result;
                        sc.push(attrs);
                    });
                },
                'remove-current': function () {
                    var menu_id = self.session.active_id;
                    var $shortcut = self.$element
                        .find('.oe-shortcuts li[data-id=' + menu_id + ']');
                    var shortcut_id = $shortcut.data('shortcut-id');
                    $shortcut.remove();
                    shortcuts_ds.unlink([shortcut_id]);
                    var sc_new = _.reject(sc, function(shortcut){ return shortcut_id === shortcut.id});
                    sc.splice(0, sc.length);
                    sc.push.apply(sc, sc_new);
                    }
            });
        }
        return this.rpc('/web/session/sc_list', {}, function(shortcuts) {
            sc.splice(0, sc.length);
            sc.push.apply(sc, shortcuts);

            self.$element.find('.oe-shortcuts')
                .html(QWeb.render('Shortcuts', {'shortcuts': shortcuts}))
                .undelegate('li', 'click')

                .delegate('li', 'click', function(e) {
                    e.stopPropagation();
                    var id = $(this).data('id');
                    self.session.active_id = id;
                    self.rpc('/web/menu/action', {'menu_id':id}, function(ir_menu_data) {
                        if (ir_menu_data.action.length){
                            self.on_action(ir_menu_data.action[0][2]);
                        }
                    });
                });
        });
    },

    on_action: function(action) {
    },
    on_preferences: function(){
        var self = this;
        var action_manager = new openerp.web.ActionManager(this);
        var dataset = new openerp.web.DataSet (this,'res.users',this.context);
        dataset.call ('action_get','',function (result){
            self.rpc('/web/action/load', {action_id:result}, function(result){
                action_manager.do_action(_.extend(result['result'], {
                    res_id: self.session.uid,
                    res_model: 'res.users',
                    flags: {
                        action_buttons: false,
                        search_view: false,
                        sidebar: false,
                        views_switcher: false,
                        pager: false
                    }
                }));
            });
        });
        this.dialog = new openerp.web.Dialog(this,{
            title: _t("Preferences"),
            width: '700px',
            buttons: [
                {text: _t("Change password"), click: function(){ self.change_password(); }},
                {text: _t("Cancel"), click: function(){ $(this).dialog('destroy'); }},
                {text: _t("Save"), click: function(){
                        var inner_viewmanager = action_manager.inner_viewmanager;
                        inner_viewmanager.views[inner_viewmanager.active_view].controller.do_save()
                        .then(function() {
                            self.dialog.stop();
                            window.location.reload();
                        });
                    }
                }
            ]
        });
       this.dialog.start().open();
       action_manager.appendTo(this.dialog);
       action_manager.render(this.dialog);
    },

    change_password :function() {
        var self = this;
        this.dialog = new openerp.web.Dialog(this, {
            title: _t("Change Password"),
            width : 'auto'
        });
        this.dialog.start().open();
        this.dialog.$element.html(QWeb.render("Change_Pwd", self));
        this.dialog.$element.find("form[name=change_password_form]").validate({
            submitHandler: function (form) {
                self.rpc("/web/session/change_password",{
                    'fields': $(form).serializeArray()
                }, function(result) {
                    if (result.error) {
                        self.display_error(result);
                        return;
                    } else {
                        self.session.logout();
                    }
                });
            }
        });
    },
    display_error: function (error) {
        return $('<div>').dialog({
            modal: true,
            title: error.title,
            buttons: [
                {text: _("Ok"), click: function() { $(this).dialog("close"); }}
            ]
        }).html(error.error);
    },
    on_logout: function() {
    }
});

openerp.web.Menu =  openerp.web.Widget.extend(/** @lends openerp.web.Menu# */{
    /**
     * @constructs openerp.web.Menu
     * @extends openerp.web.Widget
     *
     * @param parent
     * @param element_id
     * @param secondary_menu_id
     */
    init: function(parent, element_id, secondary_menu_id) {
        this._super(parent, element_id);
        this.secondary_menu_id = secondary_menu_id;
        this.$secondary_menu = $("#" + secondary_menu_id);
        this.menu = false;
        this.folded = false;
        if (window.localStorage) {
            this.folded = localStorage.getItem('oe_menu_folded') === 'true';
        }
        this.float_timeout = 700;
    },
    start: function() {
        this.$secondary_menu.addClass(this.folded ? 'oe_folded' : 'oe_unfolded');
    },
    do_reload: function() {
        var self = this;
        return this.rpc("/web/menu/load", {}, this.on_loaded).then(function () {
            if (self.current_menu) {
                self.open_menu(self.current_menu);
            }
        });
    },
    on_loaded: function(data) {
        this.data = data;
        this.$element.html(QWeb.render("Menu", { widget : this }));
        this.$secondary_menu.html(QWeb.render("Menu.secondary", { widget : this }));
        this.$element.add(this.$secondary_menu).find("a").click(this.on_menu_click);
        this.$secondary_menu.find('.oe_toggle_secondary_menu').click(this.on_toggle_fold);
    },
    on_toggle_fold: function() {
        this.$secondary_menu.toggleClass('oe_folded').toggleClass('oe_unfolded');
        if (this.folded) {
            this.$secondary_menu.find('.oe_secondary_menu.active').show();
        } else {
            this.$secondary_menu.find('.oe_secondary_menu').hide();
        }
        this.folded = !this.folded;
        if (window.localStorage) {
            localStorage.setItem('oe_menu_folded', this.folded.toString());
        }
    },
    /**
     * Opens a given menu by id, as if a user had browsed to that menu by hand
     * except does not trigger any event on the way
     *
     * @param {Number} menu_id database id of the terminal menu to select
     */
    open_menu: function (menu_id) {
        this.$element.add(this.$secondary_menu).find('.active')
                .removeClass('active');
        this.$secondary_menu.find('> .oe_secondary_menu').hide();

        var $primary_menu;
        var $secondary_submenu = this.$secondary_menu.find(
                'a[data-menu=' + menu_id +']');
        if ($secondary_submenu.length) {
            for(;;) {
                if ($secondary_submenu.hasClass('leaf')) {
                    $secondary_submenu.addClass('active');
                } else if ($secondary_submenu.hasClass('submenu')) {
                    $secondary_submenu.addClass('opened')
                }
                var $parent = $secondary_submenu.parent().show();
                if ($parent.hasClass('oe_secondary_menu')) {
                    var primary_id = $parent.data('menu-parent');
                    $primary_menu = this.$element.find(
                            'a[data-menu=' + primary_id + ']');
                    break;
                }
                $secondary_submenu = $parent.prev();
            }
        } else {
            $primary_menu = this.$element.find('a[data-menu=' + menu_id + ']');
        }
        if (!$primary_menu.length) {
            return;
        }
        $primary_menu.addClass('active');
        this.$secondary_menu.find(
            'div[data-menu-parent=' + $primary_menu.data('menu') + ']').show();
    },
    on_menu_click: function(ev, id) {
        id = id || 0;
        var $clicked_menu, manual = false;

        if (id) {
            // We can manually activate a menu with it's id (for hash url mapping)
            manual = true;
            $clicked_menu = this.$element.find('a[data-menu=' + id + ']');
            if (!$clicked_menu.length) {
                $clicked_menu = this.$secondary_menu.find('a[data-menu=' + id + ']');
            }
        } else {
            $clicked_menu = $(ev.currentTarget);
            id = $clicked_menu.data('menu');
        }

        if (this.do_menu_click($clicked_menu, manual) && id) {
            this.current_menu = id;
            this.session.active_id = id;
            this.rpc('/web/menu/action', {'menu_id': id}, this.on_menu_action_loaded);
        }
        if (ev) {
            ev.stopPropagation();
        }
        return false;
    },
    do_menu_click: function($clicked_menu, manual) {
        var $sub_menu, $main_menu,
            active = $clicked_menu.is('.active'),
            sub_menu_visible = false;

        if (this.$secondary_menu.has($clicked_menu).length) {
            $sub_menu = $clicked_menu.parents('.oe_secondary_menu');
            $main_menu = this.$element.find('a[data-menu=' + $sub_menu.data('menu-parent') + ']');
        } else {
            $sub_menu = this.$secondary_menu.find('.oe_secondary_menu[data-menu-parent=' + $clicked_menu.attr('data-menu') + ']');
            $main_menu = $clicked_menu;
        }

        sub_menu_visible = $sub_menu.is(':visible');
        this.$secondary_menu.find('.oe_secondary_menu').hide();

        $('.active', this.$element.add(this.$secondary_menu)).removeClass('active');
        $main_menu.add($clicked_menu).add($sub_menu).addClass('active');

        if (!(this.folded && manual)) {
            this.do_show_secondary($sub_menu, $main_menu);
        } else {
            this.do_show_secondary();
        }

        if ($main_menu != $clicked_menu) {
            if ($clicked_menu.is('.submenu')) {
                $sub_menu.find('.submenu.opened').each(function() {
                    if (!$(this).next().has($clicked_menu).length && !$(this).is($clicked_menu)) {
                        $(this).removeClass('opened').next().hide();
                    }
                });
                $clicked_menu.toggleClass('opened').next().toggle();
            } else if ($clicked_menu.is('.leaf')) {
                $sub_menu.toggle(!this.folded);
                return true;
            }
        } else if (this.folded) {
            if (active && sub_menu_visible) {
                $sub_menu.hide();
                return true;
            }
            return manual;
        } else {
            return true;
        }
        return false;
    },
    do_hide_secondary: function() {
        this.$secondary_menu.hide();
    },
    do_show_secondary: function($sub_menu, $main_menu) {
        var self = this;
        this.$secondary_menu.show();
        if (!arguments.length) {
            return;
        }
        if (this.folded) {
            var css = $main_menu.position(),
                fold_width = this.$secondary_menu.width() + 2,
                window_width = $(window).width();
            css.top += 33;
            css.left -= Math.round(($sub_menu.width() - $main_menu.width()) / 2);
            css.left = css.left < fold_width ? fold_width : css.left;
            if ((css.left + $sub_menu.width()) > window_width) {
                delete(css.left);
                css.right = 1;
            }
            $sub_menu.css(css);
            $sub_menu.mouseenter(function() {
                clearTimeout($sub_menu.data('timeoutId'));
                $sub_menu.data('timeoutId', null);
                return false;
            }).mouseleave(function(evt) {
                var timeoutId = setTimeout(function() {
                    if (self.folded && $sub_menu.data('timeoutId')) {
                        $sub_menu.hide().unbind('mouseenter').unbind('mouseleave');
                    }
                }, self.float_timeout);
                $sub_menu.data('timeoutId', timeoutId);
                return false;
            });
        }
        $sub_menu.show();
    },
    on_menu_action_loaded: function(data) {
        var self = this;
        if (data.action.length) {
            var action = data.action[0][2];
            action.from_menu = true;
            self.on_action(action);
        } else {
            self.on_action({type: 'null_action'});
        }
    },
    on_action: function(action) {
    }
});

openerp.web.WebClient = openerp.web.Widget.extend(/** @lends openerp.web.WebClient */{
    /**
     * @constructs openerp.web.WebClient
     * @extends openerp.web.Widget
     *
     * @param element_id
     */
    init: function(parent) {
        var self = this;
        this._super(parent);
        openerp.webclient = this;

        this.notification = new openerp.web.Notification(this);
        this.loading = new openerp.web.Loading(this);
        this.crashmanager =  new openerp.web.CrashManager();

        this.header = new openerp.web.Header(this);
        this.login = new openerp.web.Login(this);
        this.header.on_logout.add(this.on_logout);
        this.header.on_action.add(this.on_menu_action);

        this._current_state = null;
    },
    render_element: function() {
        this.$element = $('<body/>');
        this.$element.attr("id", "oe");
        this.$element.addClass("openerp");
    },
    start: function() {
        var self = this;
        this.session.bind().then(function() {
            var params = {};
            if (jQuery.param != undefined && jQuery.deparam(jQuery.param.querystring()).kitten != undefined) {
                this.$element.addClass("kitten-mode-activated");
                this.$element.delegate('img.oe-record-edit-link-img', 'hover', function(e) {
                    self.$element.toggleClass('clark-gable');
                });
            }
            self.$element.html(QWeb.render("Interface", params));
            self.menu = new openerp.web.Menu(self, "oe_menu", "oe_secondary_menu");
            self.menu.on_action.add(self.on_menu_action);

            self.notification.prependTo(self.$element);
            self.loading.appendTo($('#oe_loading'));
            self.header.appendTo($("#oe_header"));
            self.login.appendTo(self.$element);
            self.menu.start();
            if(self.session.session_is_valid()) {
                self.login.on_login_valid();
            } else {
                self.login.on_login_invalid();
            }
        });
        this.session.ready.then(function() {
            self.login.on_login_valid();
            self.header.do_update();
            self.menu.do_reload();
            if(self.action_manager)
                self.action_manager.stop();
            self.action_manager = new openerp.web.ActionManager(self);
            self.action_manager.appendTo($("#oe_app"));
            self.bind_hashchange();
            if (!self.session.openerp_entreprise) {
                self.$element.find('.oe_footer_powered').append('<span> - <a href="http://www.openerp.com/support-or-publisher-warranty-contract" target="_blank">Unsupported/Community Version</a></span>');
                $('title').html('OpenERP - Unsupported/Community Version');
            }
        });
    },
    do_reload: function() {
        return this.session.session_init().pipe(_.bind(function() {this.menu.do_reload();}, this));
    },
    do_notify: function() {
        var n = this.notification;
        n.notify.apply(n, arguments);
    },
    do_warn: function() {
        var n = this.notification;
        n.warn.apply(n, arguments);
    },
    on_logout: function() {
        this.session.session_logout();
        this.login.on_login_invalid();
        this.header.do_update();
        $(window).unbind('hashchange', this.on_hashchange);
        this.do_push_state({});
        if(this.action_manager)
            this.action_manager.stop();
        this.action_manager = null;
    },
    bind_hashchange: function() {
        $(window).bind('hashchange', this.on_hashchange);

        var state = $.bbq.getState(true);
        if (! _.isEmpty(state)) {
            $(window).trigger('hashchange');
        } else {
            this.action_manager.do_action({type: 'ir.actions.client', tag: 'default_home'});
        }
    },
    on_hashchange: function(event) {
        var state = event.getState(true);
        if (!_.isEqual(this._current_state, state)) {
            this.action_manager.do_load_state(state);
        }
        this._current_state = state;
    },
    do_push_state: function(state) {
        var url = '#' + $.param(state);
        this._current_state = _.clone(state);
        $.bbq.pushState(url);
    },
    on_menu_action: function(action) {
        this.action_manager.do_action(action);
    },
    do_action: function(action) {
        var self = this;
        // TODO replace by client action menuclick 
        if(action.menu_id) {
            this.do_reload().then(function () {
                self.menu.on_menu_click(null, action.menu_id);
            });
        }
    },
});

openerp.web.EmbeddedClient = openerp.web.Widget.extend({
    template: 'EmptyComponent',
    init: function(action_id, options) {
        this._super();
        // TODO take the xmlid of a action instead of its id 
        this.action_id = action_id;
        this.options = options || {};
        this.am = new openerp.web.ActionManager(this);
    },

    start: function() {
        var self = this;
        this.am.appendTo(this.$element.addClass('openerp'));
        return this.rpc("/web/action/load", { action_id: this.action_id }, function(result) {
            var action = result.result;
            action.flags = _.extend({
                //views_switcher : false,
                search_view : false,
                action_buttons : false,
                sidebar : false
                //pager : false
            }, self.options, action.flags || {});

            self.am.do_action(action);
        });
    },

});

openerp.web.embed = function (origin, dbname, login, key, action, options) {
    $('head').append($('<link>', {
        'rel': 'stylesheet',
        'type': 'text/css',
        'href': origin +'/web/webclient/css'
    }));
    var currentScript = document.currentScript;
    if (!currentScript) {
        var sc = document.getElementsByTagName('script');
        currentScript = sc[sc.length-1];
    }
    openerp.connection.bind(origin).then(function () {
        openerp.connection.session_authenticate(dbname, login, key, true).then(function () {
            var client = new openerp.web.EmbeddedClient(action, options);
            client.insertAfter(currentScript);
        });
    });

}

};

// vim:et fdc=0 fdl=0 foldnestmax=3 fdm=syntax:
