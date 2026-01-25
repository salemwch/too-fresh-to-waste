if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "C:/Users/EL-MECHKAT/.gradle/caches/8.13/transforms/c9b623243f122ef162427a84107b42a5/transformed/hermes-android-0.81.0-debug/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/EL-MECHKAT/.gradle/caches/8.13/transforms/c9b623243f122ef162427a84107b42a5/transformed/hermes-android-0.81.0-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

