if(NOT TARGET react-native-nitro-modules::NitroModules)
add_library(react-native-nitro-modules::NitroModules INTERFACE IMPORTED)
set_target_properties(react-native-nitro-modules::NitroModules PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "C:/WFA/apps/mobile/node_modules/react-native-nitro-modules/android/build/headers/nitromodules"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

