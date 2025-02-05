NAME=touchpad-gesture-customization
DOMAIN=coooolapps.com
UUID=${NAME}@${DOMAIN}
BUILDIR=build
ZIPPATH=${BUILDIR}/${UUID}.zip

.PHONY: pack update

${SCHEMAS_DIR}/gschemas.compiled: ${SCHEMAS_DIR}/org.gnome.shell.extensions.$(NAME).gschema.xml
		

pack:
	mkdir -p ${BUILDIR}
	cp -r extension/assets extension/stylesheet.css extension/ui extension/schemas metadata.json $(BUILDIR)
	glib-compile-schemas --strict ${BUILDIR}/schemas
	rm -f ${ZIPPATH}
	(cd ${BUILDIR} && zip -r ${UUID}.zip .)

update:
	gnome-extensions install -f ${ZIPPATH}